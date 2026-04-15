import nodemailer from "nodemailer";

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

export const emailConfigured = !!(GMAIL_USER && GMAIL_APP_PASSWORD);

const transporter = emailConfigured
  ? nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    })
  : null;

// Base email wrapper with LedgerEntries branding
function emailWrapper(content: string): string {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #f9fafb; padding: 24px;">
      <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
        <!-- Header -->
        <div style="background: #0d7e6a; padding: 24px; text-align: center;">
          <div style="display: inline-block; background: rgba(255,255,255,0.15); border-radius: 12px; padding: 10px 14px; margin-bottom: 12px;">
            <span style="color: white; font-size: 22px; font-weight: bold; letter-spacing: -0.5px;">📒</span>
          </div>
          <div style="color: white; font-size: 20px; font-weight: 700; letter-spacing: -0.3px;">LedgerEntries</div>
          <div style="color: rgba(255,255,255,0.7); font-size: 12px; margin-top: 2px;">ledgerentries.com</div>
        </div>
        <!-- Body -->
        <div style="padding: 28px 32px;">
          ${content}
        </div>
        <!-- Footer -->
        <div style="background: #f9fafb; padding: 16px 32px; border-top: 1px solid #f0f0f0; text-align: center;">
          <p style="color: #aaa; font-size: 11px; margin: 0;">
            LedgerEntries &mdash; Aapke dukaan ka digital hisaab<br/>
            ledgerentries.com
          </p>
        </div>
      </div>
    </div>
  `;
}

export async function sendVerificationEmail(
  to: string,
  username: string,
  token: string,
  appUrl: string
): Promise<boolean> {
  if (!transporter || !emailConfigured) {
    console.log(`[MAILER] Not configured. Verification token for ${username}: ${token}`);
    return false;
  }

  const verifyUrl = `${appUrl}/verify-email?token=${token}`;

  const body = `
    <h2 style="color: #111; font-size: 20px; margin: 0 0 8px;">Hello, ${username}! 👋</h2>
    <p style="color: #555; line-height: 1.6; margin: 0 0 24px;">
      Your LedgerEntries account is almost ready. Please verify your email address to start tracking your shop's accounts.
    </p>
    <div style="text-align: center; margin: 0 0 24px;">
      <a href="${verifyUrl}"
         style="background: #0d7e6a; color: white; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; letter-spacing: -0.2px;">
        ✓ Verify Email Address
      </a>
    </div>
    <div style="background: #f0fdf9; border: 1px solid #d1fae5; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
      <p style="color: #065f46; font-size: 13px; margin: 0;">
        <strong>Note:</strong> This link expires in 24 hours. If you didn't create an account on LedgerEntries, you can safely ignore this email.
      </p>
    </div>
    <p style="color: #888; font-size: 12px; margin: 0;">
      Or copy this link into your browser:<br/>
      <span style="color: #0d7e6a; word-break: break-all; font-size: 11px;">${verifyUrl}</span>
    </p>
  `;

  await transporter.sendMail({
    from: `"LedgerEntries" <${GMAIL_USER}>`,
    to,
    subject: "✓ Verify Your Email — LedgerEntries",
    html: emailWrapper(body),
  });

  return true;
}

export async function sendPasswordResetEmail(
  to: string,
  username: string,
  token: string,
  appUrl: string
): Promise<boolean> {
  if (!transporter || !emailConfigured) {
    console.log(`[MAILER] Not configured. Reset token for ${username}: ${token}`);
    return false;
  }

  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  const body = `
    <h2 style="color: #111; font-size: 20px; margin: 0 0 8px;">Password Reset Request</h2>
    <p style="color: #555; line-height: 1.6; margin: 0 0 24px;">
      Hello <strong>${username}</strong>, we received a request to reset your LedgerEntries password. Click the button below to set a new password.
    </p>
    <div style="text-align: center; margin: 0 0 24px;">
      <a href="${resetUrl}"
         style="background: #0d7e6a; color: white; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
        Reset Password
      </a>
    </div>
    <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
      <p style="color: #9a3412; font-size: 13px; margin: 0;">
        <strong>Warning:</strong> This link expires in 1 hour. If you didn't request a password reset, please ignore this email — your account is safe.
      </p>
    </div>
    <p style="color: #888; font-size: 12px; margin: 0;">
      Or copy this link into your browser:<br/>
      <span style="color: #0d7e6a; word-break: break-all; font-size: 11px;">${resetUrl}</span>
    </p>
  `;

  await transporter.sendMail({
    from: `"LedgerEntries" <${GMAIL_USER}>`,
    to,
    subject: "🔐 Reset Your Password — LedgerEntries",
    html: emailWrapper(body),
  });

  return true;
}
