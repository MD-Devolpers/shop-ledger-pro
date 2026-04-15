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

export async function sendVerificationEmail(
  to: string,
  username: string,
  token: string,
  appUrl: string
): Promise<boolean> {
  if (!transporter || !emailConfigured) {
    console.log(`[MAILER] Email not configured. Verification token for ${username}: ${token}`);
    return false;
  }

  const verifyUrl = `${appUrl}/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `"Daily Shop Ledger" <${GMAIL_USER}>`,
    to,
    subject: "Verify Your Email - Daily Shop Ledger",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-flex; width: 48px; height: 48px; background: #10b981; border-radius: 12px; align-items: center; justify-content: center;">
            <span style="color: white; font-size: 24px; font-weight: bold;">L</span>
          </div>
          <h1 style="margin: 12px 0 4px; font-size: 22px; color: #111;">Daily Shop Ledger</h1>
        </div>
        <h2 style="color: #111; font-size: 18px;">Hello, ${username}!</h2>
        <p style="color: #555; line-height: 1.6;">
          Please verify your email address to complete your account setup.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${verifyUrl}"
             style="background: #10b981; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p style="color: #888; font-size: 13px;">
          This link expires in 24 hours. If you didn't create an account, ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #aaa; font-size: 11px; text-align: center;">
          Daily Shop Ledger &mdash; Aapke dukaan ka digital hisaab
        </p>
      </div>
    `,
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
    console.log(`[MAILER] Email not configured. Reset token for ${username}: ${token}`);
    return false;
  }

  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: `"Daily Shop Ledger" <${GMAIL_USER}>`,
    to,
    subject: "Password Reset - Daily Shop Ledger",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #111;">Password Reset Request</h2>
        <p style="color: #555;">Hello <strong>${username}</strong>, click below to reset your password:</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetUrl}"
             style="background: #10b981; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #888; font-size: 13px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      </div>
    `,
  });

  return true;
}
