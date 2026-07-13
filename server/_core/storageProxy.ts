import type { Express } from "express";
import { presignGetUrl } from "./s3";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    try {
      // Step 1: Presign a GET URL against the S3-compatible backend.
      let url: string;
      try {
        url = await presignGetUrl(key);
      } catch (e) {
        console.error("[StorageProxy] presign error:", e);
        res.status(500).send("Storage proxy not configured");
        return;
      }

      // Step 2: Proxy the object, forwarding Range headers for audio/video streaming.
      const upstreamHeaders: Record<string, string> = {};
      if (req.headers.range) {
        upstreamHeaders["Range"] = req.headers.range;
      }

      const upstream = await fetch(url, { headers: upstreamHeaders });

      // Forward status and key headers back to the browser
      res.status(upstream.status);
      const forwardHeaders = [
        "content-type",
        "content-length",
        "content-range",
        "accept-ranges",
        "last-modified",
        "etag",
      ];
      for (const h of forwardHeaders) {
        const val = upstream.headers.get(h);
        if (val) res.set(h, val);
      }
      res.set("Cache-Control", "private, max-age=300");
      res.set("Access-Control-Allow-Origin", "*");

      // Stream the body
      if (!upstream.body) {
        res.end();
        return;
      }
      const reader = upstream.body.getReader();
      const pump = async () => {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        res.write(Buffer.from(value));
        await pump();
      };
      await pump();
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      if (!res.headersSent) res.status(502).send("Storage proxy error");
    }
  });
}
