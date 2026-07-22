// ─── Google Drive helpers ─────────────────────────────────────────────────────
// Shared helpers for listing a Drive folder's children and reading a Google Doc
// as plain text. Auth mirrors the library-video sync: an OAuth refresh token if
// configured, otherwise a plain GOOGLE_API_KEY (which can read folders shared
// "anyone with the link"). No Google SDK required.

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

export type DriveFile = { id: string; name: string; mimeType: string };

export const FOLDER_MIME = "application/vnd.google-apps.folder";
export const DOC_MIME = "application/vnd.google-apps.document";

export async function getDriveAccessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  if (clientId && clientSecret && refreshToken) {
    try {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId, client_secret: clientSecret,
          refresh_token: refreshToken, grant_type: "refresh_token",
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { access_token?: string };
        if (data.access_token) return data.access_token;
      }
    } catch { /* fall through to other auth methods */ }
  }
  const wsToken = process.env.GOOGLE_WORKSPACE_CLI_TOKEN;
  if (wsToken && wsToken.length > 20) return wsToken;
  const accessToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  if (accessToken && accessToken.length > 20) return accessToken;
  return null;
}

/** List the direct children of a Drive folder, optionally filtered by mimeType. */
export async function listDriveChildren(parentId: string, mimeType?: string): Promise<DriveFile[]> {
  const token = await getDriveAccessToken();
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!token && !apiKey) {
    throw new Error(
      "No Google access configured — set GOOGLE_API_KEY (for a folder shared \"anyone with link\") or OAuth credentials."
    );
  }
  const qParts = [`'${parentId}' in parents`, "trashed = false"];
  if (mimeType) qParts.push(`mimeType = '${mimeType}'`);
  const q = qParts.join(" and ");

  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q,
      fields: "nextPageToken,files(id,name,mimeType)",
      pageSize: "200",
      orderBy: "name",
      ...(pageToken ? { pageToken } : {}),
      ...(!token && apiKey ? { key: apiKey } : {}),
    });
    const res = await fetch(`${DRIVE_API_BASE}/files?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Drive API error (HTTP ${res.status}): ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { files?: DriveFile[]; nextPageToken?: string };
    files.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files;
}

/**
 * Fetch a Google Doc's plain text via the public export endpoint. Works with no
 * API key when the doc is readable via "anyone with the link" (folder sharing
 * cascades to the docs inside). Throws if the doc isn't publicly accessible.
 */
export async function fetchGoogleDocText(googleDocId: string): Promise<string> {
  const url = `https://docs.google.com/document/d/${googleDocId}/export?format=txt`;
  const resp = await fetch(url, { redirect: "follow" });
  if (!resp.ok) {
    throw new Error(`export fetch failed (HTTP ${resp.status}) — is the folder shared "anyone with link: viewer"?`);
  }
  const text = await resp.text();
  // A private doc redirects to a Google login page (HTML) instead of text.
  if (text.trimStart().toLowerCase().startsWith("<!doctype html") || text.includes("<html")) {
    throw new Error(`doc is not publicly accessible — share the folder "anyone with link: viewer"`);
  }
  return text.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();
}

/**
 * Fetch a Google Doc as HTML (preserving tables, headings, colors, bold/italic)
 * and return a self-contained fragment safe to render inside the app's
 * `.sop-rich-content` container: the doc's own <style> is scoped under that
 * class so it can't leak into the rest of the page, scripts/imports are
 * stripped, and only the <body> markup is kept. Plain-text export throws away
 * this structure, which is why SOPs looked like a wall of text.
 */
export async function fetchGoogleDocHtml(googleDocId: string): Promise<string> {
  const url = `https://docs.google.com/document/d/${googleDocId}/export?format=html`;
  const resp = await fetch(url, { redirect: "follow" });
  if (!resp.ok) {
    throw new Error(`export fetch failed (HTTP ${resp.status}) — is the folder shared "anyone with link: viewer"?`);
  }
  const html = await resp.text();
  // A private doc redirects to a Google sign-in page rather than the document.
  if (/ServiceLogin|gaia_loginform|accounts\.google\.com\/(?:v3\/)?signin/i.test(html)) {
    throw new Error(`doc is not publicly accessible — share the folder "anyone with link: viewer"`);
  }
  return sanitizeGoogleDocHtml(html);
}

/** Scope one CSS text under `.sop-rich-content` and drop @import lines. */
function scopeCss(css: string): string {
  return css
    .replace(/@import[^;]+;/gi, "")
    .replace(/([^{}]+)\{([^}]*)\}/g, (_full, sel: string, rules: string) => {
      const s = sel.trim();
      if (!s) return "";
      if (s.startsWith("@")) return `${s}{${rules}}`; // leave at-rules unscoped
      const scoped = s
        .split(",")
        .map((part) => {
          const p = part.trim();
          if (!p) return "";
          return /^body$/i.test(p) ? ".sop-rich-content" : `.sop-rich-content ${p}`;
        })
        .filter(Boolean)
        .join(", ");
      return `${scoped}{${rules}}`;
    });
}

/** Turn a full Google Docs HTML export into a scoped, script-free fragment. */
export function sanitizeGoogleDocHtml(html: string): string {
  const styleBlocks: string[] = [];
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m: RegExpExecArray | null;
  while ((m = styleRe.exec(html))) styleBlocks.push(m[1]);
  const scopedCss = styleBlocks.map(scopeCss).join("\n").trim();

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let body = (bodyMatch ? bodyMatch[1] : html)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();

  return (scopedCss ? `<style>${scopedCss}</style>\n` : "") + body;
}

// ─── Drive uploads (practice videos) ──────────────────────────────────────────
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3/files";
const UPLOAD_FOLDER_NAME = "Reformation Training – Practice Videos";
let cachedUploadFolderId: string | null = null;

/** Find (or create) the app-owned folder that holds uploaded practice videos. */
async function getOrCreateUploadFolder(token: string): Promise<string> {
  if (cachedUploadFolderId) return cachedUploadFolderId;
  const q = `name = '${UPLOAD_FOLDER_NAME}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const listRes = await fetch(
    `${DRIVE_API_BASE}/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const listData = (await listRes.json()) as any;
  if (listData.files?.[0]?.id) {
    cachedUploadFolderId = listData.files[0].id;
    return cachedUploadFolderId!;
  }
  const createRes = await fetch(`${DRIVE_API_BASE}/files?fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: UPLOAD_FOLDER_NAME, mimeType: FOLDER_MIME }),
  });
  const created = (await createRes.json()) as any;
  if (!created.id) throw new Error("Could not create the Drive upload folder");
  cachedUploadFolderId = created.id;
  return cachedUploadFolderId!;
}

/**
 * Upload a file to the app's Drive folder and return its file id. Requires an
 * OAuth token (GOOGLE_DRIVE_REFRESH_TOKEN) — a plain API key can't write.
 */
export async function uploadToDrive(name: string, mimeType: string, buffer: Buffer): Promise<string> {
  const token = await getDriveAccessToken();
  if (!token) throw new Error("Google Drive write not configured (set GOOGLE_DRIVE_REFRESH_TOKEN).");
  const folderId = await getOrCreateUploadFolder(token);
  const metadata = { name, parents: [folderId] };
  const boundary = "reformation-" + Date.now().toString(36);
  const pre =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const post = `\r\n--${boundary}--`;
  const body = Buffer.concat([Buffer.from(pre, "utf8"), buffer, Buffer.from(post, "utf8")]);
  const res = await fetch(`${DRIVE_UPLOAD_BASE}?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) {
    throw new Error(`Drive upload failed (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as any;
  if (!data.id) throw new Error("Drive upload returned no file id");
  return data.id;
}

/** Whether Drive write access is configured. */
export async function driveWriteEnabled(): Promise<boolean> {
  return !!(await getDriveAccessToken());
}

/** Best-effort delete of an app-created Drive file (used by cleanup). */
export async function deleteDriveFile(fileId: string): Promise<void> {
  const token = await getDriveAccessToken();
  if (!token) return;
  await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}
