/**
 * Email/Password Authentication Helpers
 * Replaces Manus OAuth with bcrypt-based email+password auth.
 */
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { ENV } from "./_core/env";

// ─── Password Hashing ─────────────────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Reset Token ──────────────────────────────────────────────────────────────
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function resetTokenExpiresAt(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 2); // 2-hour expiry
  return d;
}

// ─── Nodemailer Transport ─────────────────────────────────────────────────────
function getTransport() {
  const gmailUser = process.env.GMAIL_USER ?? "selena@reformationchiropractic.com";
  const gmailPass = process.env.GMAIL_APP_PASSWORD ?? "";
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailPass },
    // Fail fast instead of hanging ~60s when outbound SMTP is blocked/unreachable
    // (e.g. Railway blocks SMTP), so email never stalls a request.
    connectionTimeout: 6000,
    greetingTimeout: 6000,
    socketTimeout: 6000,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Notify a staff member that one or more SOPs were updated. Best-effort: a no-op
 * when Gmail sending isn't configured, so callers never hang or fail on it.
 */
export async function sendSopUpdatedEmail(
  toEmail: string,
  toName: string,
  sopTitles: string[]
): Promise<void> {
  if (!process.env.GMAIL_APP_PASSWORD || sopTitles.length === 0) return;
  const transport = getTransport();
  const items = sopTitles.map((t) => `<li>${escapeHtml(t)}</li>`).join("");
  const subject =
    sopTitles.length === 1 ? `SOP updated: ${sopTitles[0]}` : `${sopTitles.length} SOPs were updated`;
  await transport.sendMail({
    from: '"Reformation Training Hub" <selena@reformationchiropractic.com>',
    to: toEmail,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#2d5016">Reformation Training Hub</h2>
        <p>Hi ${escapeHtml(toName) || "there"},</p>
        <p>The following ${sopTitles.length === 1 ? "SOP was" : "SOPs were"} updated. Please review the latest version in the Training Hub.</p>
        <ul style="line-height:1.7">${items}</ul>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#999;font-size:12px">Reformation Chiropractic · Internal Training Hub</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(
  toEmail: string,
  toName: string,
  resetUrl: string
): Promise<void> {
  const transport = getTransport();
  await transport.sendMail({
    from: '"Reformation Training Hub" <selena@reformationchiropractic.com>',
    to: toEmail,
    subject: "Reset your password — Reformation Training Hub",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#2d5016">Reformation Training Hub</h2>
        <p>Hi ${toName || "there"},</p>
        <p>We received a request to reset your password. Click the button below to set a new one. This link expires in 2 hours.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#4a7c2f;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin:16px 0">Reset Password</a>
        <p style="color:#666;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#999;font-size:12px">Reformation Chiropractic · Internal Training Hub</p>
      </div>
    `,
  });
}

export async function sendQuestionNotificationEmail(
  traineeEmail: string,
  traineeName: string,
  questionText: string,
  moduleName: string | null,
  questionId?: number
): Promise<void> {
  const transport = getTransport();
  const deepLink = questionId
    ? `${APP_BASE_URL}/admin/submissions?tab=questions&id=${questionId}`
    : `${APP_BASE_URL}/admin/submissions?tab=questions`;
  await transport.sendMail({
    from: '"Reformation Training Hub" <selena@reformationchiropractic.com>',
    to: "drrobert@reformationchiropractic.com",
    cc: "selena@reformationchiropractic.com",
    replyTo: traineeEmail,
    subject: `New Question from ${traineeName} — Reformation Training Hub`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#2d5016">New Question Submitted</h2>
        <p><strong>${traineeName}</strong> submitted a question${moduleName ? ` about <em>${moduleName}</em>` : ''}:</p>
        <div style="background:#f8f9fa;border-left:4px solid #4a7c2f;padding:14px 18px;border-radius:4px;margin:16px 0;font-size:15px;color:#333">
          ${questionText.replace(/\n/g, '<br/>')}
        </div>
        <div style="text-align:center;margin:24px 0">
          <a href="${deepLink}" style="display:inline-block;background:#2d5016;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">View &amp; Reply in Hub</a>
        </div>
        <p style="color:#666;font-size:12px">Or copy this link: ${deepLink}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#999;font-size:12px">Reformation Chiropractic · Internal Training Hub</p>
      </div>
    `,
  });
}

export async function sendVideoNotificationEmail(
  traineeEmail: string,
  traineeName: string,
  videoTitle: string,
  moduleName: string | null,
  videoSubmissionId?: number
): Promise<void> {
  const transport = getTransport();
  const deepLink = videoSubmissionId
    ? `${APP_BASE_URL}/admin/submissions?tab=videos&id=${videoSubmissionId}`
    : `${APP_BASE_URL}/admin/submissions?tab=videos`;
  await transport.sendMail({
    from: '"Reformation Training Hub" <selena@reformationchiropractic.com>',
    to: "drrobert@reformationchiropractic.com",
    cc: "selena@reformationchiropractic.com",
    replyTo: traineeEmail,
    subject: `New Script Video from ${traineeName} — Reformation Training Hub`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#2d5016">New Script Video Submitted</h2>
        <p><strong>${traineeName}</strong> submitted a script video for review${moduleName ? ` (module: <em>${moduleName}</em>)` : ''}:</p>
        <div style="background:#f8f9fa;border-left:4px solid #4a7c2f;padding:14px 18px;border-radius:4px;margin:16px 0;font-size:15px;color:#333">
          <strong>${videoTitle}</strong>
        </div>
        <div style="text-align:center;margin:24px 0">
          <a href="${deepLink}" style="display:inline-block;background:#2d5016;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px">View &amp; Reply in Hub</a>
        </div>
        <p style="color:#666;font-size:12px">Or copy this link: ${deepLink}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#999;font-size:12px">Reformation Chiropractic · Internal Training Hub</p>
      </div>
    `,
  });
}

export async function sendWelcomeEmail(
  toEmail: string,
  toName: string,
  tempPassword: string,
  loginUrl: string
): Promise<void> {
  const transport = getTransport();
  await transport.sendMail({
    from: '"Reformation Training Hub" <selena@reformationchiropractic.com>',
    to: toEmail,
    subject: "Welcome to Reformation Training Hub — Your Login Details",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#2d5016">Welcome to Reformation Training Hub!</h2>
        <p>Hi ${toName || "there"},</p>
        <p>Your account has been created. Here are your login details:</p>
        <table style="background:#f8f9fa;border-radius:6px;padding:16px;width:100%;margin:16px 0">
          <tr><td style="color:#666;padding:4px 0">Email:</td><td style="font-weight:bold">${toEmail}</td></tr>
          <tr><td style="color:#666;padding:4px 0">Temporary Password:</td><td style="font-weight:bold;font-family:monospace;font-size:16px">${tempPassword}</td></tr>
        </table>
        <a href="${loginUrl}" style="display:inline-block;background:#4a7c2f;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin:16px 0">Log In Now</a>
        <p style="color:#666;font-size:13px">You'll be prompted to change your password after your first login.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#999;font-size:12px">Reformation Chiropractic · Internal Training Hub</p>
      </div>
    `,
  });
}

export async function sendQuestionAnsweredEmail(
  traineeEmail: string,
  traineeName: string,
  question: string,
  answer: string,
  reviewerName: string
): Promise<void> {
  const transport = getTransport();
  await transport.sendMail({
    from: '"Reformation Training Hub" <selena@reformationchiropractic.com>',
    to: traineeEmail,
    replyTo: "selena@reformationchiropractic.com",
    subject: `Your Question Was Answered — Reformation Training Hub`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#2d5016">Your Question Was Answered</h2>
        <p>Hi ${traineeName || "there"},</p>
        <p><strong>${reviewerName}</strong> has responded to your question:</p>
        <div style="background:#f8f9fa;border-left:4px solid #4a7c2f;padding:14px 18px;border-radius:4px;margin:16px 0;font-size:14px;color:#555">
          <strong>Your question:</strong><br/>${question}
        </div>
        <div style="background:#eef4e8;border-left:4px solid #2d5016;padding:14px 18px;border-radius:4px;margin:16px 0;font-size:14px;color:#333">
          <strong>Response:</strong><br/>${answer}
        </div>
        <p style="color:#666;font-size:13px">Log in to the Training Hub to view the full conversation in your Inbox.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#999;font-size:12px">Reformation Chiropractic · Internal Training Hub</p>
      </div>
    `,
  });
}

export async function sendVideoReviewedEmail(
  traineeEmail: string,
  traineeName: string,
  videoTitle: string,
  feedback: string | null,
  reviewerName: string
): Promise<void> {
  const transport = getTransport();
  await transport.sendMail({
    from: '"Reformation Training Hub" <selena@reformationchiropractic.com>',
    to: traineeEmail,
    replyTo: "selena@reformationchiropractic.com",
    subject: `Video Feedback Ready — Reformation Training Hub`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#2d5016">Video Feedback Ready</h2>
        <p>Hi ${traineeName || "there"},</p>
        <p><strong>${reviewerName}</strong> has reviewed your video submission:</p>
        <div style="background:#f8f9fa;border-left:4px solid #4a7c2f;padding:14px 18px;border-radius:4px;margin:16px 0;font-size:14px;color:#555">
          <strong>${videoTitle}</strong>
        </div>
        ${feedback ? `
        <div style="background:#eef4e8;border-left:4px solid #2d5016;padding:14px 18px;border-radius:4px;margin:16px 0;font-size:14px;color:#333">
          <strong>Feedback:</strong><br/>${feedback}
        </div>
        ` : '<p style="color:#666;font-size:13px">Log in to the Training Hub to view your feedback (including any voice notes) in your Inbox.</p>'}
        <p style="color:#666;font-size:13px">Log in to the Training Hub to view the full feedback in your Inbox.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#999;font-size:12px">Reformation Chiropractic · Internal Training Hub</p>
      </div>
    `,
  });
}

const APP_BASE_URL = process.env.APP_BASE_URL ?? "https://reformhub-vhmkvf2o.manus.space";

export async function sendQuestionReplyEmail(params: {
  toEmail: string;
  toName: string;
  fromName: string;
  questionId: number;
  questionText: string;
  replyMessage: string;
  isAdmin: boolean; // true = admin replied → link to trainee /submissions; false = trainee replied → link to admin /admin/submissions
}): Promise<void> {
  const transport = getTransport();
  const deepLink = params.isAdmin
    ? `${APP_BASE_URL}/submissions?tab=questions&id=${params.questionId}`
    : `${APP_BASE_URL}/admin/submissions?tab=questions&id=${params.questionId}`;
  await transport.sendMail({
    from: '"Reformation Training Hub" <selena@reformationchiropractic.com>',
    to: params.toEmail,
    replyTo: "selena@reformationchiropractic.com",
    subject: `New Reply to Your Question — Reformation Training Hub`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#2d5016">New Reply in Your Question Thread</h2>
        <p>Hi ${params.toName || "there"},</p>
        <p><strong>${params.fromName}</strong> replied to your question:</p>
        <div style="background:#f8f9fa;border-left:4px solid #4a7c2f;padding:14px 18px;border-radius:4px;margin:16px 0;font-size:14px;color:#555">
          <strong>Original question:</strong><br/>${params.questionText}
        </div>
        <div style="background:#eef4e8;border-left:4px solid #2d5016;padding:14px 18px;border-radius:4px;margin:16px 0;font-size:14px;color:#333">
          <strong>New reply:</strong><br/>${params.replyMessage}
        </div>
        <p>
          <a href="${deepLink}" style="display:inline-block;background:#2d5016;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">
            View &amp; Reply in Hub
          </a>
        </p>
        <p style="color:#666;font-size:12px">Or copy this link: ${deepLink}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#999;font-size:12px">Reformation Chiropractic · Internal Training Hub</p>
      </div>
    `,
  });
}

export async function sendVideoReplyEmail(params: {
  toEmail: string;
  toName: string;
  fromName: string;
  videoSubmissionId: number;
  videoTitle: string;
  replyMessage: string;
  isAdmin: boolean;
}): Promise<void> {
  const transport = getTransport();
  const deepLink = params.isAdmin
    ? `${APP_BASE_URL}/submissions?tab=videos&id=${params.videoSubmissionId}`
    : `${APP_BASE_URL}/admin/submissions?tab=videos&id=${params.videoSubmissionId}`;
  await transport.sendMail({
    from: '"Reformation Training Hub" <selena@reformationchiropractic.com>',
    to: params.toEmail,
    replyTo: "selena@reformationchiropractic.com",
    subject: `New Reply on Your Video Submission — Reformation Training Hub`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#2d5016">New Reply on Your Video Submission</h2>
        <p>Hi ${params.toName || "there"},</p>
        <p><strong>${params.fromName}</strong> replied to your video submission:</p>
        <div style="background:#f8f9fa;border-left:4px solid #4a7c2f;padding:14px 18px;border-radius:4px;margin:16px 0;font-size:14px;color:#555">
          <strong>${params.videoTitle}</strong>
        </div>
        <div style="background:#eef4e8;border-left:4px solid #2d5016;padding:14px 18px;border-radius:4px;margin:16px 0;font-size:14px;color:#333">
          <strong>New reply:</strong><br/>${params.replyMessage}
        </div>
        <p>
          <a href="${deepLink}" style="display:inline-block;background:#2d5016;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">
            View &amp; Reply in Hub
          </a>
        </p>
        <p style="color:#666;font-size:12px">Or copy this link: ${deepLink}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#999;font-size:12px">Reformation Chiropractic · Internal Training Hub</p>
      </div>
    `,
  });
}
