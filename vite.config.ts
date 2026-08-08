// @lovable.dev/vite-tanstack-config already includes TanStack / React / Nitro / aliases.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: { preset: "vercel" },
  vite: {
    resolve: {
      alias: {
        buffer: "buffer/",
      },
    },
    optimizeDeps: {
      include: ["buffer"],
    },
    define: {
      global: "globalThis",
    },
  },
});
