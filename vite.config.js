import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react":  ["react", "react-dom", "react-router-dom"],
          "vendor-ethers": ["ethers"],
        },
      },
    },
  },
  define: {
    global: "globalThis",
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
