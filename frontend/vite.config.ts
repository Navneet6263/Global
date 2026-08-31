import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv, type PluginOption } from "vite";

export default defineConfig(({ command, mode }) => {
  const loadedEnv = loadEnv(mode, process.cwd(), "VITE_");
  const developmentApiTarget = loadedEnv["VITE_DEV_API_TARGET"] ?? "http://127.0.0.1:4000";
  if (command === "build") validateProductionApiUrl(loadedEnv["VITE_API_URL"]);
  const envDefine = Object.fromEntries(
    Object.entries(loadedEnv).map(([key, value]) => [
      `import.meta.env.${key}`,
      JSON.stringify(value),
    ]),
  );

  const plugins: PluginOption[] = [
    tailwindcss(),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
      // Keep the security-header/error wrapper as the SSR entry point.
      server: { entry: "server" },
    }),
  ];

  if (command === "build") {
    plugins.push(nitro({ defaultPreset: "cloudflare-module" }));
  }

  plugins.push(react());

  return {
    define: envDefine,
    resolve: {
      tsconfigPaths: true,
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      ignoreOutdatedRequests: true,
    },
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/api/v1": {
          target: developmentApiTarget,
          changeOrigin: false,
        },
      },
      watch: {
        awaitWriteFinish: {
          stabilityThreshold: 1000,
          pollInterval: 100,
        },
      },
    },
    plugins,
  };
});

function validateProductionApiUrl(value: string | undefined) {
  if (!value || value === "/api/v1") return;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("VITE_API_URL must be /api/v1 or an absolute HTTPS URL");
  }
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" || loopback) {
    throw new Error("Production VITE_API_URL must use HTTPS and cannot target localhost");
  }
}
