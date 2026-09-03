/**
 * Multi-Tenant Customer & Onboarding API Routes.
 *
 * POST /api/onboarding/setup  - Step-by-step setup wizard completion
 * GET  /api/customer/me       - Fetch customer profile, persona, and knowledge status
 * POST /api/customer/persona  - Update brand / bot persona settings
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { CustomerStore, CustomerProfile } from "../services/customers.js";
import { KnowledgeStore } from "../services/knowledge.js";
import { EmailService } from "../services/email.js";
import { parseBody, sendJson } from "../utils/http.js";

const getBearerToken = (req: IncomingMessage): string => {
  const auth = req.headers.authorization || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : auth.trim();
};

export const handleCustomerRoutes = async (
  req: IncomingMessage,
  res: ServerResponse,
  url: string
): Promise<boolean> => {
  // POST /api/onboarding/setup (Allows customer creation / configuration)
  if (req.method === "POST" && url === "/api/onboarding/setup") {
    try {
      const raw = await parseBody(req);
      const body = JSON.parse(raw) as {
        key?: string;
        email?: string;
        name?: string;
        company?: string;
        website?: string;
        botTitle?: string;
        botRole?: string;
        tone?: string;
        greeting?: string;
        prompts?: string[];
        knowledgeText?: string;
        knowledgeTitle?: string;
      };

      const customer = CustomerStore.createOrUpdate({
        key: body.key,
        email: body.email || "subscriber@domain.com",
        name: body.name,
        company: body.company,
        website: body.website,
        botTitle: body.botTitle,
        botRole: body.botRole,
        tone: body.tone,
        greeting: body.greeting,
        prompts: body.prompts
      });

      // If initial knowledge content was uploaded in wizard
      if (body.knowledgeText && body.knowledgeText.trim().length > 10) {
        KnowledgeStore.add({
          title: body.knowledgeTitle || `${customer.company} Knowledge`,
          type: "markdown",
          customerKey: customer.key,
          content: body.knowledgeText.trim()
        });
      }

      return sendJson(res, 200, {
        success: true,
        customer,
        portalUrl: `/app?key=${customer.key}`
      }), true;
    } catch (err) {
      return sendJson(res, 400, { error: err instanceof Error ? err.message : "Invalid setup payload" }), true;
    }
  }

  // GET /api/customer/me
  if (req.method === "GET" && (url === "/api/customer/me" || url === "/api/customer/profile")) {
    const token = getBearerToken(req);
    const adminKey = process.env.ADMIN_KEY;

    if (adminKey && token === adminKey) {
      return sendJson(res, 200, {
        role: "admin",
        authenticated: true,
        company: "ZeroRoute Admin Master",
        totalCustomers: CustomerStore.list().length
      }), true;
    }

    const customer = CustomerStore.get(token);
    if (!customer || customer.status !== "active") {
      return sendJson(res, 401, { error: "Invalid or expired subscriber key" }), true;
    }

    const docs = KnowledgeStore.list();

    return sendJson(res, 200, {
      role: "customer",
      authenticated: true,
      customer,
      knowledgeCount: docs.length
    }), true;
  }

  // GET /api/admin/customers (Admin list of all subscribers & activity)
  if (req.method === "GET" && (url === "/api/admin/customers" || url === "/api/customers")) {
    const token = getBearerToken(req);
    const adminKey = process.env.ADMIN_KEY;

    if (!adminKey || token !== adminKey) {
      return sendJson(res, 401, { error: "Admin authorization required" }), true;
    }

    const customers = CustomerStore.list();
    return sendJson(res, 200, {
      success: true,
      count: customers.length,
      customers
    }), true;
  }

  // DELETE /api/admin/customers (Admin delete/revoke subscriber)
  if (req.method === "DELETE" && url.startsWith("/api/admin/customers/")) {
    const token = getBearerToken(req);
    const adminKey = process.env.ADMIN_KEY;

    if (!adminKey || token !== adminKey) {
      return sendJson(res, 401, { error: "Admin authorization required" }), true;
    }

    const targetKey = url.replace("/api/admin/customers/", "").trim();
    const deleted = CustomerStore.delete(targetKey);
    return sendJson(res, 200, { success: deleted }), true;
  }

  // POST /api/customer/persona (Customer updating their own persona)
  if (req.method === "POST" && url === "/api/customer/persona") {
    const token = getBearerToken(req);
    const customer = CustomerStore.get(token);
    if (!customer) {
      return sendJson(res, 401, { error: "Unauthorized: Invalid customer key" }), true;
    }

    try {
      const raw = await parseBody(req);
      const body = JSON.parse(raw) as Partial<CustomerProfile>;

      const updated = CustomerStore.createOrUpdate({
        key: customer.key,
        email: customer.email,
        company: body.company || customer.company,
        botTitle: body.botTitle || customer.botTitle,
        botRole: body.botRole || customer.botRole,
        tone: body.tone || customer.tone,
        greeting: body.greeting || customer.greeting,
        prompts: body.prompts || customer.prompts,
        persona: body.persona
      });

      return sendJson(res, 200, { success: true, customer: updated }), true;
    } catch (err) {
      return sendJson(res, 400, { error: "Failed to update persona" }), true;
    }
  }

  // POST /api/customer/recover (Step 1: Request 6-digit OTP to email)
  if (req.method === "POST" && url === "/api/customer/recover") {
    try {
      const raw = await parseBody(req);
      const body = JSON.parse(raw) as { email: string };
      const email = body.email?.trim().toLowerCase();

      if (!email || !email.includes("@")) {
        return sendJson(res, 400, { error: "Please enter a valid email address" }), true;
      }

      const customer = CustomerStore.getByEmail(email);
      if (!customer) {
        return sendJson(res, 404, { error: "No active subscription found for this email address" }), true;
      }

      // Generate 6-digit OTP and send via Resend
      const code = EmailService.createOtp(email);
      await EmailService.sendOtpEmail({
        toEmail: customer.email,
        code,
        companyName: customer.company
      });

      return sendJson(res, 200, {
        success: true,
        message: `Verification code sent to ${customer.email}.`,
        email: customer.email,
        company: customer.company
      }), true;
    } catch (err) {
      return sendJson(res, 400, { error: "Invalid recovery request" }), true;
    }
  }

  // POST /api/customer/verify-otp (Step 2: Verify 6-digit OTP and grant access)
  if (req.method === "POST" && url === "/api/customer/verify-otp") {
    try {
      const raw = await parseBody(req);
      const body = JSON.parse(raw) as { email: string; code: string };
      const email = body.email?.trim().toLowerCase();
      const code = body.code?.trim();

      if (!email || !code) {
        return sendJson(res, 400, { error: "Email and verification code are required" }), true;
      }

      const verifyResult = EmailService.verifyOtp(email, code);
      if (!verifyResult.valid) {
        return sendJson(res, 400, { error: verifyResult.error || "Invalid verification code" }), true;
      }

      const customer = CustomerStore.getByEmail(email);
      if (!customer) {
        return sendJson(res, 404, { error: "Customer record not found" }), true;
      }

      return sendJson(res, 200, {
        success: true,
        message: "Identity verified successfully! Welcome back.",
        portalUrl: `/app?key=${customer.key}`,
        key: customer.key,
        customer
      }), true;
    } catch (err) {
      return sendJson(res, 400, { error: "Verification failed" }), true;
    }
  }

  // POST /api/webhooks/dodo (Automated Subscription & Payment Webhook)
  if (req.method === "POST" && (url === "/api/webhooks/dodo" || url === "/api/webhook/dodo")) {
    try {
      const raw = await parseBody(req);
      const event = JSON.parse(raw);
      console.log(`[DodoWebhook] Received event: ${event.type || event.event_type || "unknown"}`);

      const data = event.data || event;
      const customerEmail = data.customer?.email || data.email;
      const customerName = data.customer?.name || data.name || "Subscriber";

      if (customerEmail) {
        const cleanEmail = customerEmail.trim().toLowerCase();
        let existing = CustomerStore.getByEmail(cleanEmail);

        // Events: payment.succeeded, subscription.active, subscription.created
        if (event.type?.includes("payment.succeeded") || event.type?.includes("subscription.active") || event.type?.includes("subscription.created")) {
          const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // +30 days
          const customer = CustomerStore.createOrUpdate({
            key: existing?.key,
            email: cleanEmail,
            name: customerName,
            status: "active",
            subscriptionExpires: expiresAt
          });

          // Send confirmation & magic portal link
          await EmailService.sendOtpEmail({
            toEmail: customer.email,
            code: "PRO-ACTIVE",
            companyName: customer.company
          });

          console.log(`[DodoWebhook] Subscription activated for ${cleanEmail}. Valid until: ${new Date(expiresAt).toISOString()}`);
        }

        // Events: subscription.canceled, subscription.expired
        if (event.type?.includes("subscription.canceled") || event.type?.includes("subscription.expired")) {
          if (existing) {
            CustomerStore.createOrUpdate({
              key: existing.key,
              email: cleanEmail,
              status: "canceled"
            });
            console.log(`[DodoWebhook] Subscription canceled for ${cleanEmail}`);
          }
        }
      }

      return sendJson(res, 200, { received: true }), true;
    } catch (err) {
      console.error("[DodoWebhook] Processing failed:", err);
      return sendJson(res, 400, { error: "Webhook processing error" }), true;
    }
  }

  return false;
};
