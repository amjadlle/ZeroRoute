/**
 * Email & OTP Service for ZeroRoute.
 * Uses Resend API (https://resend.com) with native HTTPS fetch.
 */

import { randomInt } from "node:crypto";

interface SendOtpOptions {
  toEmail: string;
  code: string;
  companyName: string;
}

// In-memory temporary OTP store (Code, Email, Expiry)
interface OtpEntry {
  code: string;
  email: string;
  expiresAt: number;
  attempts: number;
}

const otpStore = new Map<string, OtpEntry>();

export const EmailService = {
  /**
   * Generates a cryptographically secure 6-digit verification code valid for 10 minutes.
   */
  createOtp(email: string): string {
    const cleanEmail = email.trim().toLowerCase();
    // Cryptographically secure 6-digit integer (100000 - 999999)
    const code = randomInt(100000, 1000000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpStore.set(cleanEmail, {
      code,
      email: cleanEmail,
      expiresAt,
      attempts: 0
    });

    return code;
  },

  /**
   * Verifies the provided 6-digit code.
   */
  verifyOtp(email: string, userCode: string): { valid: boolean; error?: string } {
    const cleanEmail = email.trim().toLowerCase();
    const entry = otpStore.get(cleanEmail);

    if (!entry) {
      return { valid: false, error: "No verification code requested. Please request a new code." };
    }

    if (Date.now() > entry.expiresAt) {
      otpStore.delete(cleanEmail);
      return { valid: false, error: "Verification code expired. Please request a new one." };
    }

    if (entry.attempts >= 5) {
      otpStore.delete(cleanEmail);
      return { valid: false, error: "Too many failed attempts. Please request a new code." };
    }

    if (entry.code !== userCode.trim()) {
      entry.attempts++;
      return { valid: false, error: "Incorrect verification code. Please check your email." };
    }

    // Success: consume the code so it cannot be re-used
    otpStore.delete(cleanEmail);
    return { valid: true };
  },

  /**
   * Dispatches the 6-digit OTP email via Resend API.
   */
  async sendOtpEmail({ toEmail, code, companyName }: SendOtpOptions): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || "ZeroRoute <onboarding@resend.dev>";

    if (!apiKey || apiKey.trim() === "") {
      console.log(`[EmailService Dev Mode] OTP for ${toEmail}: ${code}`);
      return true;
    }

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #050608; border-radius: 16px; border: 1px solid #1f2230; color: #f1f5f9;">
        <div style="margin-bottom: 24px;">
          <h2 style="margin: 0; font-size: 20px; color: #ffffff; font-weight: 800; letter-spacing: -0.5px;">ZeroRoute Gateway</h2>
          <p style="margin: 4px 0 0; color: #94a3b8; font-size: 13px;">Security & Account Verification</p>
        </div>
        
        <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px;">
          We received a request to access the dashboard for <strong>${companyName}</strong>. Use the verification code below to securely log in:
        </p>

        <div style="background: #0f121a; border: 1px solid #ef444440; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #ef4444;">
            ${code}
          </span>
          <p style="margin: 8px 0 0; font-size: 11px; color: #64748b; font-family: monospace;">Valid for 10 minutes • Single use only</p>
        </div>

        <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 20px 0 0;">
          If you did not request this verification code, you can safely ignore this email. Your dashboard key remains secure.
        </p>
      </div>
    `;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject: `${code} is your ZeroRoute Verification Code`,
          html: htmlBody
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("[EmailService] Resend API Error:", errText);
        return false;
      }

      console.log(`[EmailService] OTP email successfully dispatched to ${toEmail}`);
      return true;
    } catch (err) {
      console.error("[EmailService] Dispatch failed:", err);
      return false;
    }
  }
};
