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
