/**
 * Knowledge Base API Routes.
 *
 * GET  /api/knowledge         - List all uploaded documents and sources
 * POST /api/knowledge/upload  - Upload .md, .txt, .pdf parsed text
 * POST /api/knowledge/crawl   - Scrape web page URL content
 * DELETE /api/knowledge/:id   - Delete document
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { isAuthorized } from "../middleware/auth.js";
import { KnowledgeStore } from "../services/knowledge.js";
import { parseBody, sendJson } from "../utils/http.js";

const ADMIN_KEY = process.env.ADMIN_KEY;

export const handleKnowledgeRoutes = async (
  req: IncomingMessage,
  res: ServerResponse,
  url: string
): Promise<boolean> => {
  if (!url.startsWith("/api/knowledge")) return false;

  // Authorization check for all /api/knowledge endpoints
  if (!isAuthorized(req, ADMIN_KEY, true)) {
    return sendJson(res, 401, { error: "Unauthorized: Invalid admin key" }), true;
  }

  // GET /api/knowledge
  if (req.method === "GET" && (url === "/api/knowledge" || url === "/api/knowledge/")) {
    const docs = KnowledgeStore.list();
    return sendJson(res, 200, { documents: docs, total: docs.length }), true;
  }

  // POST /api/knowledge/upload
  if (req.method === "POST" && url === "/api/knowledge/upload") {
    try {
      const raw = await parseBody(req);
      const body = JSON.parse(raw) as {
        title: string;
        type?: "markdown" | "text" | "pdf" | "url";
        content: string;
      };

      if (!body.title || !body.content) {
        return sendJson(res, 400, { error: "Title and content are required." }), true;
      }

      const doc = KnowledgeStore.add({
        title: body.title,
        type: body.type || "text",
        content: body.content
      });

      return sendJson(res, 201, { success: true, document: doc }), true;
    } catch (err) {
      return sendJson(res, 400, { error: err instanceof Error ? err.message : "Invalid JSON body" }), true;
    }
  }

  // POST /api/knowledge/crawl
  if (req.method === "POST" && url === "/api/knowledge/crawl") {
    try {
      const raw = await parseBody(req);
      const body = JSON.parse(raw) as { url: string };
      if (!body.url || (!body.url.startsWith("http://") && !body.url.startsWith("https://"))) {
        return sendJson(res, 400, { error: "Valid http/https URL is required." }), true;
      }

      // SSRF Protection: Block internal and cloud metadata IPs
      const parsed = new URL(body.url);
      const host = parsed.hostname.toLowerCase();
      if (
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host === "169.254.169.254" ||
        host.startsWith("10.") ||
        host.startsWith("192.168.") ||
        host.startsWith("172.16.") ||
        host.endsWith(".internal") ||
        host.endsWith(".local")
      ) {
        return sendJson(res, 400, { error: "Access to private or local network addresses is prohibited." }), true;
      }

      const fetchRes = await fetch(body.url, {
        headers: { "User-Agent": "ZeroRoute-Knowledge-Crawler/1.0" },
        signal: AbortSignal.timeout(10000)
      });

      if (!fetchRes.ok) {
        return sendJson(res, 400, { error: `Failed to fetch URL: HTTP ${fetchRes.status}` }), true;
      }

      const html = await fetchRes.text();

      // Lightweight HTML to Text / Markdown cleanup
      const cleanText = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
        .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
        .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ")
        .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, " ")
        .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, "\n\n## $1\n")
        .replace(/<li[^>]*>(.*?)<\/li>/gi, "\n- $1")
        .replace(/<p[^>]*>(.*?)<\/p>/gi, "\n\n$1")
        .replace(/<br\s*[\/]?>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\n\s*\n\s*\n/g, "\n\n")
        .trim();

      if (!cleanText || cleanText.length < 20) {
        return sendJson(res, 400, { error: "Could not extract meaningful text from URL." }), true;
      }

      const urlObj = new URL(body.url);
      const title = urlObj.hostname + urlObj.pathname;

      const doc = KnowledgeStore.add({
        title: title.length > 50 ? title.substring(0, 50) + "..." : title,
        type: "url",
        content: cleanText.substring(0, 30000), // Cap at 30k chars
        sourceUrl: body.url
      });

      return sendJson(res, 201, { success: true, document: doc }), true;
    } catch (err) {
      return sendJson(res, 500, { error: err instanceof Error ? err.message : "Crawl failed" }), true;
    }
  }

  // DELETE /api/knowledge/:id
  if (req.method === "DELETE" && url.startsWith("/api/knowledge/")) {
    const id = url.split("/")[3];
    if (!id) return sendJson(res, 400, { error: "Document ID is required" }), true;

    const deleted = KnowledgeStore.remove(id);
    if (!deleted) return sendJson(res, 404, { error: "Document not found" }), true;

    return sendJson(res, 200, { success: true, id }), true;
  }

  return false;
};
