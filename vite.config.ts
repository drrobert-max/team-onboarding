import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    // Allow the deployment host (Railway/Render/etc.) plus local dev.
    // Set ALLOWED_HOSTS as a comma-separated list to add specific hosts.
    allowedHosts: (process.env.ALLOWED_HOSTS ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean)
      .concat(["localhost", "127.0.0.1"]),
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
