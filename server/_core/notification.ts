import { TRPCError } from "@trpc/server";
import nodemailer from "nodemailer";

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

const trimValue = (value: string): string => value.trim();
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const OWNER_EMAIL =
  process.env.OWNER_EMAIL ??
  process.env.GMAIL_USER ??
  "selena@reformationchiropractic.com";

const getTransport = () =>
  nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER ?? "selena@reformationchiropractic.com",
      pass: process.env.GMAIL_APP_PASSWORD ?? "",
    },
  });

const validatePayload = (input: NotificationPayload): NotificationPayload => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required.",
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required.",
    });
  }

  const title = trimValue(input.title);
  const content = trimValue(input.content);

  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`,
    });
  }

  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`,
    });
  }

  return { title, content };
};

/**
 * Dispatches a project-owner notification through the Manus Notification Service.
 * Returns `true` if the request was accepted, `false` when the upstream service
 * cannot be reached (callers can fall back to email/slack). Validation errors
 * bubble up as TRPC errors so callers can fix the payload.
 */
export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  const { title, content } = validatePayload(payload);

  if (!process.env.GMAIL_APP_PASSWORD) {
    console.warn(
      "[Notification] GMAIL_APP_PASSWORD not set — skipping owner notification."
    );
    return false;
  }

  try {
    await getTransport().sendMail({
      from: `"Reformation Training Hub" <${process.env.GMAIL_USER ?? "selena@reformationchiropractic.com"}>`,
      to: OWNER_EMAIL,
      subject: title,
      text: content,
      html: `<div style="font-family:sans-serif"><h3 style="color:#2d5016">${title}</h3><p>${content.replace(/\n/g, "<br/>")}</p></div>`,
    });
    return true;
  } catch (error) {
    console.warn("[Notification] Error sending owner email:", error);
    return false;
  }
}
