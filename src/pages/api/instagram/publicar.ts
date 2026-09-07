// Publicador automático de Instagram.
//
// Lo llama el cron de Vercel (ver vercel.json) los martes, jueves y sábados:
// mira en el calendario si hoy toca publicar algo y, si toca, lo sube a la
// cuenta con la API de Instagram. El calendario y las imágenes los prepara
// `node scripts/programar-instagram.mjs`.
//
// La API trabaja en dos pasos: primero se crea un «contenedor» con la imagen y
// el pie, y después se publica ese contenedor.
//
// Variables de entorno (en Vercel):
//   IG_USER_ID       identificador de la cuenta profesional
//   IG_ACCESS_TOKEN  token de larga duración (caduca a los 60 días)
//   CRON_SECRET      lo envía Vercel en la cabecera Authorization
import type { APIRoute } from "astro";
import { CRON_SECRET, IG_ACCESS_TOKEN, IG_USER_ID } from "astro:env/server";
import calendario from "../../../data/calendario-instagram.json";
import { SITE_URL } from "../../../consts";

export const prerender = false;

const API = "https://graph.instagram.com/v23.0";

/** Fecha de hoy en Madrid, que es la zona en la que está escrito el calendario. */
function hoyEnMadrid(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: calendario.zona }).format(new Date());
}

async function llamar(url: string, init?: RequestInit) {
  const respuesta = await fetch(url, init);
  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const detalle = (cuerpo as { error?: { message?: string } })?.error?.message;
    throw new Error(`${respuesta.status} ${detalle ?? respuesta.statusText}`);
  }
  return cuerpo;
}

/** ¿Está ya en la cuenta? Evita duplicar si el cron se reintenta. */
async function yaPublicado(pie: string, usuario: string, token: string) {
  const url = `${API}/${usuario}/media?fields=caption&limit=25&access_token=${token}`;
  const { data = [] } = (await llamar(url)) as { data?: { caption?: string }[] };
  const primeraLinea = pie.split("\n")[0];
  return data.some((media) => media.caption?.startsWith(primeraLinea));
}

export const GET: APIRoute = async ({ request }) => {
  const responder = (estado: number, cuerpo: Record<string, unknown>) =>
    new Response(JSON.stringify(cuerpo, null, 2), {
      status: estado,
      headers: { "content-type": "application/json; charset=utf-8" },
    });

  if (!CRON_SECRET || request.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return responder(401, { error: "No autorizado." });
  }

  const usuario = IG_USER_ID;
  const token = IG_ACCESS_TOKEN;
  if (!usuario || !token) {
    return responder(500, { error: "Faltan IG_USER_ID o IG_ACCESS_TOKEN." });
  }

  const hoy = hoyEnMadrid();
  const toca = calendario.publicaciones.find((p) => p.fecha === hoy);
  if (!toca) return responder(200, { hoy, publicado: false, motivo: "Hoy no toca publicar." });

  try {
    if (await yaPublicado(toca.pie, usuario, token)) {
      return responder(200, { hoy, publicado: false, motivo: "Ya estaba publicado." });
    }

    // Paso 1: contenedor con la imagen y el pie.
    const contenedor = (await llamar(`${API}/${usuario}/media`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        image_url: new URL(toca.imagen, SITE_URL).href,
        caption: toca.pie,
        access_token: token,
      }),
    })) as { id?: string };
    if (!contenedor.id) throw new Error("La API no devolvió el contenedor.");

    // Paso 2: publicarlo.
    const publicada = (await llamar(`${API}/${usuario}/media_publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ creation_id: contenedor.id, access_token: token }),
    })) as { id?: string };

    return responder(200, {
      hoy,
      publicado: true,
      contenido: toca.contenido,
      idioma: toca.lang,
      id: publicada.id,
    });
  } catch (error) {
    // El cron reintenta al día siguiente, así que el fallo se registra y ya.
    return responder(502, {
      hoy,
      publicado: false,
      contenido: toca.contenido,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
