// @ts-check

import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import { defineConfig, envField, fontProviders } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://www.psicopindartzen.es/",
  // El sitio sigue siendo estático; el adapter solo traduce las redirecciones
  // (p. ej. / → /es/ del i18n) a configuración nativa de Vercel en el build.
  adapter: vercel(),
  // Redirección declarada aquí para que el adapter la emita como redirect
  // nativo de Vercel (308) en lugar de la página meta-refresh del i18n.
  redirects: {
    "/": "/es/",
  },
  // Credenciales del publicador automático de Instagram (src/pages/api/).
  // Son secretas y se leen en tiempo de ejecución, no en el build.
  env: {
    schema: {
      IG_USER_ID: envField.string({ context: "server", access: "secret", optional: true }),
      IG_ACCESS_TOKEN: envField.string({ context: "server", access: "secret", optional: true }),
      CRON_SECRET: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
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
