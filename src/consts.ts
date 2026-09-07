// Datos globales del sitio. Importables desde cualquier punto del proyecto.

export const SITE_NAME = "PsiCopIndartzen";

// Dominio de producción (el vértice sin www redirige 308 a www en Vercel).
export const SITE_URL = "https://www.psicopindartzen.es";

// Candidatura a la Junta de Gobierno del Colegio Oficial de Psicología de Bizkaia (COPB).
export const ELECTION_YEAR = 2026;

// TODO: teléfono y resto de redes pendientes de recibir.
// El correo es la cuenta que gestiona la candidatura para la web.
export const CONTACT = {
  email: "psicopindartzen.rs@gmail.com",
  phone: "",
  social: {
    instagram: "psicopindartzen",
    linkedin: "",
    twitter: "",
  },
};

export const COPB_URL = "https://copbizkaia.org";

// Lema de la candidatura, tal y como figura en el logotipo.
export const CLAIM = {
  es: "La fuerza de una profesión",
  eu: "Lanbide baten indarra",
} as const;

export const SITE = {
  es: {
    title: "PsiCopIndartzen",
    tagline: "Candidatura a la Junta de Gobierno del COP Bizkaia 2026",
    claim: "La fuerza de una profesión",
    description:
      "PsiCopIndartzen es una candidatura a la Junta de Gobierno del Colegio Oficial de Psicología de Bizkaia que apuesta por la transparencia, la cercanía y la diversidad profesional de todos los ámbitos de la Psicología.",
  },
  eu: {
    title: "PsiCopIndartzen",
    tagline: "Bizkaiko Psikologiaren Elkargoko Gobernu Batzarrerako hautagaitza 2026",
    claim: "Lanbide baten indarra",
    description:
      "PsiCopIndartzen Bizkaiko Psikologiaren Elkargo Ofizialeko Gobernu Batzarrerako hautagaitza da, gardentasunaren, hurbiltasunaren eta Psikologiaren arlo guztien aniztasun profesionalaren alde.",
  },
} as const;

export const LOCALES = ["es", "eu"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";

// Retrocompatibilidad con los componentes del template todavía sin migrar.
export const SITE_TITLE = SITE.es.title;
export const SITE_DESCRIPTION = SITE.es.description;
