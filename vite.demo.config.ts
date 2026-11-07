import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The demo on GitHub Pages: the browser app alone, without the Cloudflare plugin and
// the Worker. Build it in the "demo" mode, which answers the API from sample data
// (src/demo/api.ts), with the base of the Pages site:
//   pnpm exec vite build --config vite.demo.config.ts --mode demo --base /polaris/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: { outDir: "demo-dist", emptyOutDir: true },
});
