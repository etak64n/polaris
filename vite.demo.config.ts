import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// ECharts, with zrender under it, is most of the code of the dashboards and changes only
// with its version, so it gets a chunk of its own that browsers keep across deployments.
// The charts load only the parts that they use, and the chunk is still about 560 kB, so
// the warning about large chunks starts above it.
const ECHARTS = { name: "echarts", test: /node_modules[\\/](echarts|zrender)[\\/]/ };
const CHUNK_WARNING_KB = 600;

// The demo on GitHub Pages: the browser app alone, without the Cloudflare plugin and
// the Worker. Build it in the "demo" mode, which answers the API from sample data
// (src/demo/api.ts), with the base of the Pages site:
//   pnpm exec vite build --config vite.demo.config.ts --mode demo --base /polaris/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    outDir: "demo-dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: CHUNK_WARNING_KB,
    rolldownOptions: { output: { codeSplitting: { groups: [ECHARTS] } } },
  },
});
