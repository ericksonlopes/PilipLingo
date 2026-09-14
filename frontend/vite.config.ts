import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Substitui um service worker de producao antigo ao voltar para o Vite dev.
 * Sem isso, uma PWA instalada em localhost pode continuar servindo o bundle
 * anterior e esconder as atualizacoes recebidas por HMR.
 */
const devServiceWorkerCleanup: Plugin = {
  name: "piliplingo-dev-service-worker-cleanup",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      if (pathname !== "/sw.js") {
        next();
        return;
      }

      response.statusCode = 200;
      response.setHeader("Content-Type", "application/javascript; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      response.end(`
        self.addEventListener("install", () => self.skipWaiting());
        self.addEventListener("activate", (event) => {
          event.waitUntil(
            Promise.all([
              self.registration.unregister(),
              caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
            ])
              .then(() => self.clients.matchAll({ type: "window" }))
              .then((clients) => Promise.all(clients.map((client) => client.navigate(client.url))))
          );
        });
      `);
    });
  },
};

// host: true expoe o dev server na rede local, para abrir no celular.
export default defineConfig({
  plugins: [
    devServiceWorkerCleanup,
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "PilipLingo - aprenda ingles",
        short_name: "PilipLingo",
        description: "Vocabulario e pratica de ingles no seu bolso.",
        lang: "pt-BR",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // A API nao e cacheada: dados de vocabulario devem vir sempre frescos.
        navigateFallbackDenylist: [/^\/api/],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    // Bind mount no Docker/Windows nem sempre emite eventos de filesystem.
    watch: process.env.VITE_USE_POLLING ? { usePolling: true, interval: 300 } : undefined,
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_TARGET ?? "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  preview: { host: true, port: 5173 },
});
