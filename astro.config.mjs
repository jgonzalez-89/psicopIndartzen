// @ts-check

import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig, fontProviders } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://psicopindartzen.eus/",
  integrations: [mdx(), sitemap({ i18n: { defaultLocale: "es", locales: { es: "es-ES", eu: "eu-ES" } } })],
  i18n: {
    locales: ["es", "eu"],
    defaultLocale: "es",
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: true,
    },
  },
  vite: {
    plugins: [tailwindcss()],
    // Permite exponer el servidor local por un túnel (cloudflared / ngrok) para revisiones.
    server: { allowedHosts: [".trycloudflare.com", ".ngrok-free.app", ".ngrok.app", ".ngrok.io"] },
    preview: { allowedHosts: [".trycloudflare.com", ".ngrok-free.app", ".ngrok.app", ".ngrok.io"] },
  },
  fonts: [
    {
      provider: fontProviders.local(),
      name: "Atkinson",
      cssVariable: "--font-atkinson",
      fallbacks: ["sans-serif"],
      options: {
        variants: [
          {
            src: ["./src/assets/fonts/atkinson-regular.woff"],
            weight: 400,
            style: "normal",
            display: "swap",
          },
          {
            src: ["./src/assets/fonts/atkinson-bold.woff"],
            weight: 700,
            style: "normal",
            display: "swap",
          },
        ],
      },
    },
  ],
});
