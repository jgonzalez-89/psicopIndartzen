import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const locale = z.enum(["es", "eu"]);

// Ámbitos de la Psicología que representa la candidatura.
// Un archivo por ámbito e idioma: src/content/ambitos/<es|eu>/<slug>.md
const ambitos = defineCollection({
  loader: glob({ base: "./src/content/ambitos", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) =>
    z.object({
      lang: locale,
      // Identificador compartido entre las versiones en castellano y euskera.
      key: z.string(),
      title: z.string(),
      description: z.string(),
      heroImage: image().optional(),
      order: z.number().default(0),
      // Slugs de la colección `candidatura` que se muestran en este ámbito.
      personas: z.array(z.string()).default([]),
    }),
});

// Integrantes de la candidatura. Un solo archivo por persona: los datos
// estructurados (foto, cargo, orden) son comunes y solo cambia la prosa.
const candidatura = defineCollection({
  loader: glob({ base: "./src/content/candidatura", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) =>
    z.object({
      nombre: z.string(),
      cargo: z.object({ es: z.string(), eu: z.string() }),
      bio: z.object({
        es: z.array(z.string()),
        // Pendiente de traducción: vacío mientras no llegue el texto en euskera.
        eu: z.array(z.string()).default([]),
      }),
      image: image().optional(),
      // Orden protocolario dentro de la Junta.
      order: z.number().default(99),
      // Aparece en el bloque destacado de la portada.
      featured: z.boolean().default(false),
    }),
});

// Páginas de texto largo (manifiesto, programa, contacto...).
// Un archivo por página e idioma: src/content/paginas/<es|eu>/<slug>.md
const paginas = defineCollection({
  loader: glob({ base: "./src/content/paginas", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) =>
    z.object({
      lang: locale,
      key: z.string(),
      title: z.string(),
      description: z.string(),
      heroImage: image().optional(),
    }),
});

// Noticias y publicaciones de campaña.
const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) =>
    z.object({
      lang: locale,
      key: z.string().optional(),
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      heroImage: image().optional(),
    }),
});

export const collections = {
  ambitos,
  candidatura,
  paginas,
  blog,
};
