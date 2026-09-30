import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function githubPagesFallback(): Plugin {
  return {
    name: "github-pages-404",
    apply: "build",
    closeBundle() {
      const dist = path.resolve(rootDir, "dist");
      fs.copyFileSync(path.join(dist, "index.html"), path.join(dist, "404.html"));
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), githubPagesFallback()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/api/, ""),
      },
    },
  },
});
