import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: {
    port: 5173,
    // Same-origin API in development so cookies & CSRF behave like production.
    proxy: { "/api": { target: "http://localhost:3000", changeOrigin: false } },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // Keep React and everything that imports it in one chunk to preserve load order.
          if (/[\/]i18next[\/]/.test(id)) return "i18n";
          if (id.includes("date-fns")) return "date";
          if (id.includes("recharts") || /[\/]d3-/.test(id) || id.includes("victory-vendor")) return "charts";
          return "vendor";
        },
      },
    },
  },
});
