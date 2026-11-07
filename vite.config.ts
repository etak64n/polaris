import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// ECharts, with zrender under it, is most of the code of the dashboards and changes only
// with its version, so it gets a chunk of its own that browsers keep across deployments.
const ECHARTS = { name: "echarts", test: /node_modules[\\/](echarts|zrender)[\\/]/ };

// The Cloudflare plugin reads cloudflare.config.ts, runs the Worker in the
// Workers runtime during `cf dev`, and builds it with the browser app.
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  // shadcn/ui components import the app as "@/…".
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: { rolldownOptions: { output: { codeSplitting: { groups: [ECHARTS] } } } },
});
