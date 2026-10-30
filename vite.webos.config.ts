import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    target: "chrome87",
    outDir: "dist-webos",
    lib: {
      entry: "src/main.tsx",
      name: "Still",
      formats: ["iife"],
      fileName: () => "app.js",
      cssFileName: "app",
    },
    cssCodeSplit: false,
  },
});
