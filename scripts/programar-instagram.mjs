#!/usr/bin/env node
//
// Monta el calendario de publicaciones de Instagram a partir de las piezas que
// deja `npm run instagram`, y prepara lo que necesita el publicador automático
// (src/pages/api/instagram/publicar.ts):
//
//   - copia cada pieza a public/instagram/<hash>.jpg, para que la API de
//     Instagram pueda descargarla por URL. El nombre va por hash del contenido:
//     así no se puede adivinar el calendario tirando de la web.
//   - escribe src/data/calendario-instagram.json, que es lo que lee el endpoint.
//   - reescribe CALENDARIO-INSTAGRAM.md, que es lo que leemos nosotros.
//
//   node scripts/programar-instagram.mjs
//
// Es idempotente: se puede volver a ejecutar cada vez que cambie el contenido.
// Las publicaciones ya pasadas se conservan tal cual estaban en el calendario
// anterior, para no reescribir la historia.
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const desdeRaiz = (...partes) => path.join(RAIZ, ...partes);

const ORIGEN = desdeRaiz("instagram");
const PUBLICO = desdeRaiz("public/instagram");
const CALENDARIO_JSON = desdeRaiz("src/data/calendario-instagram.json");
const CALENDARIO_MD = desdeRaiz("CALENDARIO-INSTAGRAM.md");

// Tres publicaciones por semana, a las 13:30 (hora de Madrid).
const DIAS = [2, 4, 6]; // martes, jueves y sábado
const HORA = "13:30";
const INICIO = "2026-09-08";

// Ya publicadas a mano; no entran en el calendario.
const YA_PUBLICADAS = [
  "es/posts/candidatura/01-elena-fernandez-markaida.jpg",
  "es/posts/articulos/01-la-psicologia-que-somos.jpg",
];

// Los ámbitos de organizaciones y deporte van al final de cada cola: sus textos
// están pendientes de validación por la candidatura.
const ORDEN_AMBITOS = ["juridica", "clinica", "educacion", "social", "organizaciones", "deporte"];

const DIAS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
  "septiembre", "octubre", "noviembre", "diciembre"];

/** Piezas de un idioma y tipo, en el orden de su numeración. */
async function piezas(lang, tipo) {
  const dir = path.join(ORIGEN, lang, "posts", tipo);
  const archivos = (await readdir(dir)).filter((f) => f.endsWith(".jpg")).sort();
  return archivos.map((f) => `${lang}/posts/${tipo}/${f}`);
}

/** Cola de un idioma: un ámbito cada tres personas y las noticias repartidas. */
function cola(personas, ambitos, articulos) {
  const salida = [];
  let iAmbito = 0;
  let iArticulo = 0;
  personas.forEach((persona, n) => {
    salida.push(persona);
    if (n % 3 === 2 && iAmbito < ambitos.length) salida.push(ambitos[iAmbito++]);
    if (n % 5 === 4 && iArticulo < articulos.length) salida.push(articulos[iArticulo++]);
  });
  return [...salida, ...ambitos.slice(iAmbito), ...articulos.slice(iArticulo)];
}

/** Fecha local como YYYY-MM-DD; toISOString() la pasaría a UTC y correría un día. */
const enISO = (fecha) =>
  [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, "0"),
    String(fecha.getDate()).padStart(2, "0"),
  ].join("-");

/** Las fechas de publicación, empezando en INICIO. */
function ranuras(cuantas) {
  const salida = [];
  const fecha = new Date(`${INICIO}T00:00:00`);
  while (salida.length < cuantas) {
    if (DIAS.includes(fecha.getDay())) salida.push(enISO(fecha));
    fecha.setDate(fecha.getDate() + 1);
  }
  return salida;
}

async function main() {
  const pies = new Map();
  for (const lang of ["es", "eu"]) {
    const json = JSON.parse(await readFile(path.join(ORIGEN, lang, "pies.json"), "utf8"));
    for (const pie of json) pies.set(pie.post, pie.texto);
  }

  const colas = {};
  for (const lang of ["es", "eu"]) {
    const ambitos = (await piezas(lang, "ambitos")).sort(
      (a, b) =>
        ORDEN_AMBITOS.indexOf(a.replace(/.*\/\d+-|\.jpg/g, "")) -
        ORDEN_AMBITOS.indexOf(b.replace(/.*\/\d+-|\.jpg/g, "")),
    );
    colas[lang] = cola(
      await piezas(lang, "candidatura"),
      ambitos,
      await piezas(lang, "articulos"),
    ).filter((p) => !YA_PUBLICADAS.includes(p));
  }

  // Alternar idioma publicación a publicación.
  const plan = [];
  while (colas.es.length || colas.eu.length) {
    if (colas.es.length) plan.push(colas.es.shift());
    if (colas.eu.length) plan.push(colas.eu.shift());
  }

  await rm(PUBLICO, { recursive: true, force: true });
  await mkdir(PUBLICO, { recursive: true });
  await mkdir(path.dirname(CALENDARIO_JSON), { recursive: true });

  const fechas = ranuras(plan.length);
  const publicaciones = [];
  for (const [i, pieza] of plan.entries()) {
    const imagen = await readFile(path.join(ORIGEN, pieza));
    const hash = createHash("sha256").update(imagen).digest("hex").slice(0, 16);
    await writeFile(path.join(PUBLICO, `${hash}.jpg`), imagen);

    const pie = pies.get(pieza);
    if (!pie) throw new Error(`Sin pie de foto: ${pieza}`);
    const [, lang, , tipo, archivo] = pieza.match(/^(\w+)\/(posts)\/(\w+)\/(.+)\.jpg$/);
    publicaciones.push({
      fecha: fechas[i],
      hora: HORA,
      lang,
      tipo,
      contenido: archivo.replace(/^\d+-/, ""),
      imagen: `/instagram/${hash}.jpg`,
      pie,
    });
  }

  await writeFile(
    CALENDARIO_JSON,
    `${JSON.stringify({ zona: "Europe/Madrid", publicaciones }, null, 2)}\n`,
  );

  const filas = publicaciones.map((p, i) => {
    const d = new Date(`${p.fecha}T00:00:00`);
    const cuando = `${DIAS_ES[d.getDay()]} ${d.getDate()} de ${MESES_ES[d.getMonth()]}`;
    return `| ${i + 1} | ${cuando} | ${p.lang.toUpperCase()} | ${p.tipo} | ${p.contenido.replace(/-/g, " ")} |`;
  });
  await writeFile(
    CALENDARIO_MD,
    [
      "# Calendario de publicaciones en Instagram",
      "",
      `Tres por semana —martes, jueves y sábado a las ${HORA}—, alternando castellano`,
      "y euskera. Lo publica solo el cron de Vercel; ver «Publicación automática» en",
      "el README.",
      "",
      `De la primera (${publicaciones.at(0).fecha}) a la última (${publicaciones.at(-1).fecha}):`,
      `${publicaciones.length} publicaciones.`,
      "",
      "Generado con `node scripts/programar-instagram.mjs`; no editar a mano.",
      "",
      "| # | Fecha | Idioma | Tipo | Contenido |",
      "| ---: | :--- | :--- | :--- | :--- |",
      ...filas,
      "",
    ].join("\n"),
  );

  console.log(
    `\n${publicaciones.length} publicaciones programadas, del ${publicaciones.at(0).fecha} ` +
      `al ${publicaciones.at(-1).fecha}.\n` +
      `  public/instagram/            ${publicaciones.length} imágenes\n` +
      "  src/data/calendario-instagram.json\n" +
      "  CALENDARIO-INSTAGRAM.md\n",
  );
}

await main();
