import { upsertLibraryVideo } from "./db";

const FOLDER_ID = "1FSs-CM6tiM0m61RLXFy2gmHN4P7LHWzv";
const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

// Skip Google Workspace native formats (Docs, Sheets, Slides, Forms, etc.)
const SKIP_MIME_TYPES = new Set([
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.presentation",
  "application/vnd.google-apps.form",
  "application/vnd.google-apps.drawing",
  "application/vnd.google-apps.script",
  "application/vnd.google-apps.folder",
  "application/vnd.google-apps.shortcut",
]);

// Auto-categorize based on video name keywords
function categorize(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("autism")) return "Autism";
  if (n.includes("adhd")) return "ADHD";
  if (n.includes("reflex") || n.includes("primitive")) return "Primitive Reflexes";
  if (n.includes("speech")) return "Speech & Language";
  if (n.includes("sensory")) return "Sensory";
  if (n.includes("innate") || n.includes("intelligence")) return "Chiropractic Philosophy";
  if (n.includes("nervous system") || n.includes("neuro")) return "Neurology";
  if (n.includes("behavior") || n.includes("behaviour")) return "Behavior";
  if (n.includes("regulation") || n.includes("regulate")) return "Regulation";
  if (n.includes("skool") || n.includes("live")) return "Live Sessions";
  if (n.includes("genetics") || n.includes("genetic")) return "Genetics";
  if (n.includes("gut") || n.includes("nutrition") || n.includes("diet")) return "Nutrition & Gut";
  if (n.includes("sleep")) return "Sleep";
  if (n.includes("anxiety") || n.includes("stress")) return "Anxiety & Stress";
  return "General";
}

async function getToken(): Promise<string | null> {
  // Priority 1: Auto-refresh using OAuth client credentials (permanent)
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });
      if (res.ok) {
        const data = await res.json() as { access_token: string };
        if (data.access_token) {
          console.log('[LibrarySync] Got fresh access token via refresh token');
          return data.access_token;
        }
      } else {
        const err = await res.text();
        console.error('[LibrarySync] Failed to refresh token:', err);
      }
    } catch (e) {
      console.error('[LibrarySync] Token refresh error:', e);
    }
  }

  // Priority 2: Manus connector token
  const wsToken = process.env.GOOGLE_WORKSPACE_CLI_TOKEN;
  if (wsToken && wsToken.length > 20) return wsToken;

  // Priority 3: Stored access token (may be expired)
  const accessToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  if (accessToken && accessToken.length > 20) return accessToken;

  return null;
}

export async function syncLibraryVideos(): Promise<{ synced: number; errors: number; skipped: number; found: string[] }> {
  const token = await getToken();
  // Fallback: a plain API key can list publicly shared folders — free and
  // no OAuth setup. Set GOOGLE_API_KEY and share the folder "anyone with link".
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!token && !apiKey) {
    console.error(
      "[LibrarySync] No Google auth — set GOOGLE_API_KEY (public folder) or GOOGLE_DRIVE_CLIENT_ID/SECRET/REFRESH_TOKEN"
    );
    return { synced: 0, errors: 1, skipped: 0, found: [] };
  }

  let synced = 0;
  let errors = 0;
  let skipped = 0;
  let pageToken: string | undefined;
  const found: string[] = [];

  try {
    do {
      const params = new URLSearchParams({
        q: `"${FOLDER_ID}" in parents and trashed = false`,
        fields: "nextPageToken,files(id,name,mimeType,createdTime)",
        pageSize: "100",
        ...(pageToken ? { pageToken } : {}),
        ...(!token && apiKey ? { key: apiKey } : {}),
      });

      const res = await fetch(`${DRIVE_API_BASE}/files?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const body = await res.text();
        console.error("[LibrarySync] Drive API error:", res.status, body);
        errors++;
        break;
      }

      const data = await res.json() as {
        files: Array<{ id: string; name: string; mimeType: string; createdTime: string }>;
        nextPageToken?: string;
      };

      pageToken = data.nextPageToken;
      console.log(`[LibrarySync] Found ${data.files?.length ?? 0} files in this page`);

      for (const file of data.files ?? []) {
        console.log(`[LibrarySync] File: "${file.name}" | mimeType: ${file.mimeType}`);
        found.push(`${file.name} (${file.mimeType})`);

        if (SKIP_MIME_TYPES.has(file.mimeType)) {
          console.log(`[LibrarySync] Skipping Google Workspace file: ${file.name}`);
          skipped++;
          continue;
        }

        try {
          await upsertLibraryVideo({
            driveFileId: file.id,
            name: file.name,
            category: categorize(file.name),
            driveCreatedAt: file.createdTime ? new Date(file.createdTime) : null,
          });
          synced++;
        } catch (e) {
          console.error("[LibrarySync] Failed to upsert:", file.name, e);
          errors++;
        }
      }
    } while (pageToken);
  } catch (e) {
    console.error("[LibrarySync] Unexpected error:", e);
    errors++;
  }

  console.log(`[LibrarySync] Done: ${synced} synced, ${skipped} skipped, ${errors} errors`);
  return { synced, errors, skipped, found };
}
