import { DEFAULT_LOCALE, LOCALES, type Locale } from "../consts";

export { DEFAULT_LOCALE, LOCALES, type Locale };

export const LOCALE_NAMES: Record<Locale, string> = {
  es: "Castellano",
  eu: "Euskara",
};

export const LOCALE_SHORT: Record<Locale, string> = {
  es: "ES",
  eu: "EU",
};

// TODO: revisar las cadenas en euskera con una persona euskaldun antes de publicar.
export const ui = {
  es: {
    "nav.inicio": "Inicio",
    "nav.candidatura": "Candidatura",
    "nav.ambitos": "Ámbitos",
    "nav.programa": "Programa",
    "nav.noticias": "Noticias",
    "nav.contacto": "Contacto",
    "cta.conocenos": "Conócenos",
    "cta.verCandidatura": "Ver la candidatura",
    "cta.leerMas": "Leer más",
    "cta.volver": "Volver",
    "ambitos.titulo": "Ámbitos de la Psicología",
    "ambitos.intro":
      "Representamos todos y cada uno de los ámbitos de la Psicología, con experiencia y conocimiento teórico-práctico de todas las especialidades.",
    "candidatura.titulo": "La candidatura",
    "candidatura.intro":
      "Un equipo diverso, con profesionales de todas las especialidades y de todos los momentos de la carrera.",
    "candidatura.junta": "Junta de Gobierno",
    "candidatura.vocalias": "Vocalías y grupos de trabajo",
    "candidatura.enEsteAmbito": "En este ámbito",
    "noticias.titulo": "Noticias",
    "footer.derechos": "Todos los derechos reservados.",
    "footer.aviso": "Aviso legal",
    "footer.privacidad": "Política de privacidad",
    "idioma.cambiar": "Cambiar de idioma",
    "404.titulo": "Página no encontrada",
    "404.texto": "La página que buscas no existe o ha cambiado de dirección.",
    "500.titulo": "Ha ocurrido un error",
    "500.texto": "Vuelve a intentarlo en unos instantes.",
  },
  eu: {
    "nav.inicio": "Hasiera",
    "nav.candidatura": "Hautagaitza",
    "nav.ambitos": "Arloak",
    "nav.programa": "Programa",
    "nav.noticias": "Berriak",
    "nav.contacto": "Harremana",
    "cta.conocenos": "Ezagutu gaitzazu",
    "cta.verCandidatura": "Ikusi hautagaitza",
    "cta.leerMas": "Irakurri gehiago",
    "cta.volver": "Itzuli",
    "ambitos.titulo": "Psikologiaren arloak",
    "ambitos.intro":
      "Psikologiaren arlo guztiak ordezkatzen ditugu, espezialitate guztietako esperientzia eta ezagutza teoriko-praktikoarekin.",
    "candidatura.titulo": "Hautagaitza",
    "candidatura.intro":
      "Talde anitza, espezialitate guztietako eta ibilbideko une guztietako profesionalekin.",
    "candidatura.junta": "Gobernu Batzarra",
    "candidatura.vocalias": "Batzordekidetzak eta lan taldeak",
    "candidatura.enEsteAmbito": "Arlo honetan",
    "noticias.titulo": "Berriak",
    "footer.derechos": "Eskubide guztiak erreserbatuta.",
    "footer.aviso": "Lege oharra",
    "footer.privacidad": "Pribatutasun politika",
    "idioma.cambiar": "Aldatu hizkuntza",
    "404.titulo": "Ez da orria aurkitu",
    "404.texto": "Bilatzen ari zaren orria ez da existitzen edo helbidez aldatu da.",
    "500.titulo": "Errore bat gertatu da",
    "500.texto": "Saiatu berriro une batzuk barru.",
  },
} as const;

export type UIKey = keyof (typeof ui)["es"];

/** Extrae el idioma de una URL del tipo /es/candidatura. */
export function getLocaleFromUrl(url: URL): Locale {
  const [, segment] = url.pathname.split("/");
  if ((LOCALES as readonly string[]).includes(segment)) return segment as Locale;
  return DEFAULT_LOCALE;
}

/** Devuelve la función de traducción para un idioma dado. */
export function useTranslations(lang: Locale) {
  return function t(key: UIKey): string {
    return ui[lang][key] ?? ui[DEFAULT_LOCALE][key];
  };
}

/** Construye una ruta con el prefijo de idioma: path("es", "candidatura") -> "/es/candidatura". */
export function path(lang: Locale, ...segments: string[]): string {
  const clean = segments.filter(Boolean).join("/").replace(/^\/+|\/+$/g, "");
  return clean ? `/${lang}/${clean}` : `/${lang}/`;
}

/** Misma página en el otro idioma, conservando la ruta. */
export function switchLocalePath(url: URL, target: Locale): string {
  const parts = url.pathname.split("/").filter(Boolean);
  if ((LOCALES as readonly string[]).includes(parts[0])) parts[0] = target;
  else parts.unshift(target);
  return `/${parts.join("/")}`;
}
