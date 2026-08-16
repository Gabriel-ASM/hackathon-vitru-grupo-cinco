import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const visualFrontRoot = path.resolve(
  process.cwd(),
  "Front",
  "SOFIA-EDU-CHAT",
  "sofia&Edu-chat",
);

export default defineConfig({
  root: visualFrontRoot,
  plugins: [react()],
  server: {
    port: 5173,
    fs: {
      allow: [process.cwd()],
    },
    proxy: {
      "/api": "http://localhost:3001",
      "/calendario": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/analytics": {
        target: "http://localhost:5174",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: path.resolve(process.cwd(), "client", "dist"),
    emptyOutDir: true,
  },
});
