import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The Cloudflare plugin reads cloudflare.config.ts, runs the Worker in the
// Workers runtime during `cf dev`, and builds it with the browser app.
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
});
