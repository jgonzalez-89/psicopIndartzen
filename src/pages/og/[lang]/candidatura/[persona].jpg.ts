// Tarjeta Open Graph de cada integrante de la candidatura: se genera durante
// el build en /og/<lang>/candidatura/<persona>.jpg.
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { LOCALES, type Locale } from "../../../../consts";
import { renderPersonaOg, rutaImagenDeEntrada } from "../../../../lib/og";

export async function getStaticPaths() {
  const personas = await getCollection("candidatura");
  return LOCALES.flatMap((lang) =>
    personas.map((persona) => ({ params: { lang, persona: persona.id }, props: { persona } })),
  );
}

export const GET: APIRoute = async ({ params, props }) => {
  const { persona } = props as { persona: Awaited<ReturnType<typeof getCollection<"candidatura">>>[number] };
  const lang = params.lang as Locale;

  const jpeg = await renderPersonaOg({
    nombre: persona.data.nombre,
    cargo: persona.data.cargo[lang],
    foto: await rutaImagenDeEntrada(persona.filePath),
    lang,
  });

  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
