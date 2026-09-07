#!/usr/bin/env node
//
// Genera los materiales gráficos de la campaña para Instagram a partir del
// mismo contenido que alimenta la web (src/content/**). No publica nada: deja
// en ./instagram/ los archivos listos para subir a mano desde el móvil, porque
// las historias destacadas no se pueden crear por la API de Meta.
//
//   node scripts/instagram.mjs            todo, en los dos idiomas
//   node scripts/instagram.mjs --lang=eu  solo euskera
//
// La maquetación es la misma que la de src/lib/og.ts: satori convierte el
// árbol a SVG con el texto trazado y sharp lo rasteriza a JPEG.
import { mkdir, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import satori from "satori";
import sharp from "sharp";

const RAIZ = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const SALIDA = path.join(RAIZ, "instagram");
const desdeRaiz = (...partes) => path.join(RAIZ, ...partes);

// Espejo de src/consts.ts.
const ELECTION_YEAR = 2026;
const SITE_URL = "https://www.psicopindartzen.es";

// Espejo de los tokens @theme de src/styles/global.css.
const BRAND_900 = "#093671";
const BRAND_700 = "#073B6C";
const BRAND_400 = "#0085C9";
const BRAND_100 = "#D6E6F3";
const BRAND_50 = "#F1F7FC";
const GREEN = "#5A9C29";
const GREEN_DARK = "#208C40";
const ORANGE = "#F79B1F";
const ORANGE_DARK = "#E46122";

// Formatos nativos de Instagram.
const POST = { w: 1080, h: 1350 }; // publicación vertical 4:5
const STORY = { w: 1080, h: 1920 }; // historia 9:16

// Franjas que la interfaz de Instagram tapa en las historias.
const SEGURO_SUP = 230;
const SEGURO_INF = 270;

const IDIOMAS = ["es", "eu"];

const T = {
  es: {
    eyebrow: `CANDIDATURA · COP BIZKAIA ${ELECTION_YEAR}`,
    ambito: "ÁMBITO",
    trayectoria: "TRAYECTORIA",
    noticia: "NOTICIA",
    manifiesto: "MANIFIESTO",
    equipo: "CANDIDATURA",
    avalan: "Nos representan en este ámbito",
    continua: "sigue",
  },
  eu: {
    eyebrow: `HAUTAGAITZA · COP BIZKAIA ${ELECTION_YEAR}`,
    ambito: "ARLOA",
    trayectoria: "IBILBIDEA",
    noticia: "BERRIA",
    manifiesto: "MANIFESTUA",
    equipo: "HAUTAGAITZA",
    avalan: "Arlo honetan ordezkatzen gaituzte",
    continua: "jarraitzen du",
  },
};

// Color de acento de cada ámbito, para que los destacados se distingan.
const COLOR_AMBITO = {
  juridica: BRAND_900,
  clinica: BRAND_400,
  educacion: GREEN,
  social: ORANGE_DARK,
  organizaciones: BRAND_700,
  deporte: GREEN_DARK,
};

// ---------------------------------------------------------------- utilidades

/** Árbol que espera satori, sin JSX. */
const el = (type, style, children) => ({
  type,
  props: children === undefined ? { style } : { style, children },
});

const img = (src, style) => ({ type: "img", props: { src, style } });

/** Numeración de los archivos: 1 -> "01". */
const dosDigitos = (n) => String(n).padStart(2, "0");

const dataUri = (buffer, mime) => `data:${mime};base64,${buffer.toString("base64")}`;

/** Lee un Markdown con frontmatter y devuelve los datos y el cuerpo. */
async function leerMd(file) {
  const bruto = await readFile(file, "utf8");
  const partido = bruto.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!partido) throw new Error(`Sin frontmatter: ${file}`);
  return { data: load(partido[1]) ?? {}, cuerpo: partido[2].trim(), file };
}

async function leerColeccion(dir) {
  const entradas = await readdir(desdeRaiz("src/content", dir), { withFileTypes: true });
  const archivos = entradas.filter((e) => e.isFile() && e.name.endsWith(".md"));
  return Promise.all(
    archivos.map(async (e) => {
      const file = desdeRaiz("src/content", dir, e.name);
      return { ...(await leerMd(file)), slug: e.name.replace(/\.md$/, "") };
    }),
  );
}

/** Resuelve una ruta declarada en el frontmatter, relativa al propio Markdown. */
const rutaDeclarada = (file, declarada) =>
  declarada ? path.resolve(path.dirname(file), declarada) : undefined;

// Las fuentes y los logotipos son los mismos en todas las piezas.
let cacheAssets = null;
function cargarAssets() {
  cacheAssets ??= (async () => {
    const [regular, bold, claimSvg, logoSvg, isoSvg] = await Promise.all([
      readFile(desdeRaiz("src/assets/fonts/atkinson-regular.woff")),
      readFile(desdeRaiz("src/assets/fonts/atkinson-bold.woff")),
      readFile(desdeRaiz("src/assets/brand/logotipo-claim.svg")),
      readFile(desdeRaiz("src/assets/brand/logotipo.svg")),
      readFile(desdeRaiz("src/assets/brand/isotipo.svg")),
    ]);
    // satori solo admite mapas de bits: los SVG se rasterizan una vez.
    const [claim, logo, iso] = await Promise.all([
      sharp(claimSvg).resize({ width: 900 }).png().toBuffer(),
      sharp(logoSvg).resize({ width: 720 }).png().toBuffer(),
      sharp(isoSvg).resize({ width: 620 }).png().toBuffer(),
    ]);
    return {
      fonts: [
        { name: "Atkinson", data: regular, weight: 400, style: "normal" },
        { name: "Atkinson", data: bold, weight: 700, style: "normal" },
      ],
      claim: dataUri(claim, "image/png"),
      logo: dataUri(logo, "image/png"),
      iso: dataUri(iso, "image/png"),
    };
  })();
  return cacheAssets;
}

/**
 * Recorta una imagen al formato pedido priorizando la zona con el rostro.
 * Devuelve null si el original es tan pequeño que ampliarlo se notaría: en ese
 * caso la pieza se compone sin fotografía.
 */
async function recortar(file, ancho, alto, position = sharp.strategy.attention) {
  if (!file) return null;
  const original = await readFile(file);
  const { width = 0, height = 0 } = await sharp(original).metadata();
  if (width < ancho * 0.6 || height < alto * 0.6) return null;
  const buffer = await sharp(original)
    .resize(ancho, alto, { fit: "cover", position, kernel: "lanczos3" })
    .jpeg({ quality: 88 })
    .toBuffer();
  return dataUri(buffer, "image/jpeg");
}

async function pintar(nodo, { w, h }) {
  const { fonts } = await cargarAssets();
  const svg = await satori(nodo, { width: w, height: h, fonts });
  return sharp(Buffer.from(svg)).jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toBuffer();
}

async function guardar(rutaRelativa, buffer) {
  const destino = path.join(SALIDA, rutaRelativa);
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, buffer);
  return rutaRelativa;
}

/**
 * Quita el marcado en línea del Markdown. satori pinta texto plano: si no se
 * limpia, los asteriscos de las negritas acaban impresos en la historia.
 */
const aTextoPlano = (texto) =>
  texto
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*\*|___)(.+?)\1/g, "$2")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(?<![\w*])\*(?!\s)([^*]+?)(?<!\s)\*(?![\w*])/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s{0,3}[-*+]\s+/gm, "· ");

/** Fecha en el formato que espera EXIF: «AAAA:MM:DD HH:MM:SS». */
const marcaExif = (fecha) =>
  fecha.toISOString().slice(0, 19).replace("T", " ").replace(/-/g, ":");

/** El nombre encoge cuando es largo para que nunca se parta en dos líneas. */
const tamNombre = (nombre, base) =>
  nombre.length > 26 ? base - 16 : nombre.length > 20 ? base - 8 : base;

/**
 * Reparte los párrafos entre historias sin cortar ninguno por la mitad.
 * satori no mide el texto, así que se estima: a 40 px sobre 900 px útiles
 * caben unos 45 caracteres por línea y 18 líneas por historia.
 */
function paginar(parrafos, { porLinea = 45, porPagina = 18 } = {}) {
  const paginas = [];
  let actual = [];
  let lineas = 0;
  for (const parrafo of parrafos) {
    const suyas = Math.ceil(parrafo.length / porLinea) + 1; // +1 por el espacio entre párrafos
    if (lineas + suyas > porPagina && actual.length > 0) {
      paginas.push(actual);
      actual = [];
      lineas = 0;
    }
    actual.push(parrafo);
    lineas += suyas;
  }
  if (actual.length > 0) paginas.push(actual);
  return paginas;
}

// ------------------------------------------------------------------- piezas

/** El logotipo sobre una pastilla blanca, para los fondos oscuros. */
const marcaEnPastilla = (fuente, { ancho = 420, alinear = "center" } = {}) =>
  el(
    "div",
    {
      display: "flex",
      alignSelf: alinear,
      backgroundColor: "#ffffff",
      borderRadius: 28,
      paddingLeft: 40,
      paddingRight: 40,
      paddingTop: 26,
      paddingBottom: 26,
    },
    [img(fuente, { width: ancho })],
  );

/** Encabezado con la línea naranja y el rótulo de sección. */
const rotulo = (texto, color = ORANGE_DARK, tam = 22) =>
  el("div", { display: "flex", alignItems: "center" }, [
    el("div", { width: 44, height: 4, borderRadius: 2, backgroundColor: ORANGE, marginRight: 16 }),
    el("div", { fontSize: tam, fontWeight: 700, letterSpacing: 2.6, color }, texto),
  ]);

/** Publicación vertical de una persona: retrato a sangre y ficha debajo. */
async function postPersona({ nombre, cargo, foto, lang }) {
  const { logo } = await cargarAssets();
  const altoFoto = 880;
  // Un retrato vertical dentro de un hueco apaisado: recortar desde arriba
  // conserva la cabeza, cosa que `attention` no siempre acierta.
  const retrato = await recortar(foto, POST.w, altoFoto, "top");

  return pintar(
    el(
      "div",
      {
        width: POST.w,
        height: POST.h,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
        fontFamily: "Atkinson",
      },
      [
        retrato
          ? img(retrato, { width: POST.w, height: altoFoto, objectFit: "cover" })
          : el(
              "div",
              {
                display: "flex",
                width: POST.w,
                height: altoFoto,
                alignItems: "center",
                justifyContent: "center",
                backgroundImage: `linear-gradient(135deg, ${BRAND_400}, ${BRAND_900})`,
                color: "#ffffff",
                fontSize: 300,
                fontWeight: 700,
              },
              nombre.charAt(0),
            ),
        el(
          "div",
          {
            display: "flex",
            flexDirection: "column",
            flex: 1,
            paddingLeft: 64,
            paddingRight: 64,
            paddingTop: 44,
            paddingBottom: 40,
            backgroundImage: `radial-gradient(circle at 8% 0%, ${BRAND_50} 0%, #ffffff 60%)`,
          },
          [
            rotulo(T[lang].eyebrow),
            el(
              "div",
              {
                fontSize: tamNombre(nombre, 72),
                fontWeight: 700,
                color: BRAND_900,
                lineHeight: 1.05,
                marginTop: 20,
              },
              nombre,
            ),
            el("div", { fontSize: 38, fontWeight: 700, color: GREEN_DARK, marginTop: 10 }, cargo),
            el("div", { display: "flex", flex: 1 }),
            img(logo, { width: 300 }),
          ],
        ),
      ],
    ),
    POST,
  );
}

/** Portada de historia: el retrato enmarcado sobre el azul de marca. */
async function storyPersona({ nombre, cargo, foto, lang }) {
  const { claim } = await cargarAssets();
  const fw = 720;
  const fh = 960;
  const retrato = await recortar(foto, fw, fh);

  return pintar(
    el(
      "div",
      {
        width: STORY.w,
        height: STORY.h,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        backgroundColor: BRAND_900,
        backgroundImage: `linear-gradient(160deg, ${BRAND_700} 0%, ${BRAND_900} 55%, #05244a 100%)`,
        fontFamily: "Atkinson",
        paddingTop: SEGURO_SUP,
        paddingBottom: SEGURO_INF,
      },
      [
        el("div", {
          position: "absolute",
          top: -220,
          right: -200,
          width: 620,
          height: 620,
          borderRadius: 9999,
          backgroundColor: BRAND_400,
          opacity: 0.28,
        }),
        rotulo(T[lang].eyebrow, ORANGE, 24),
        el(
          "div",
          {
            display: "flex",
            position: "relative",
            width: fw,
            height: fh,
            marginTop: 46,
            flexShrink: 0,
          },
          [
            el("div", {
              position: "absolute",
              top: -14,
              left: -14,
              width: fw + 28,
              height: fh + 28,
              borderRadius: 40,
              backgroundImage: `linear-gradient(135deg, ${BRAND_400}, ${ORANGE})`,
              transform: "rotate(-2.5deg)",
            }),
            retrato
              ? img(retrato, { width: fw, height: fh, borderRadius: 32, objectFit: "cover" })
              : el(
                  "div",
                  {
                    display: "flex",
                    width: fw,
                    height: fh,
                    borderRadius: 32,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundImage: `linear-gradient(135deg, ${BRAND_50}, ${BRAND_100})`,
                    color: BRAND_400,
                    fontSize: 260,
                    fontWeight: 700,
                  },
                  nombre.charAt(0),
                ),
          ],
        ),
        el(
          "div",
          {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: 940,
            marginTop: 52,
          },
          [
            el(
              "div",
              {
                fontSize: tamNombre(nombre, 76),
                fontWeight: 700,
                color: "#ffffff",
                textAlign: "center",
                lineHeight: 1.05,
              },
              nombre,
            ),
            el(
              "div",
              { fontSize: 40, fontWeight: 700, color: ORANGE, marginTop: 14, textAlign: "center" },
              cargo,
            ),
          ],
        ),
        el("div", { display: "flex", flex: 1 }),
        marcaEnPastilla(claim),
      ],
    ),
    STORY,
  );
}

/** Historia de texto: la trayectoria, el manifiesto o el cuerpo de un artículo. */
async function storyTexto({ kicker, titulo, parrafos, pagina, paginas, lang }) {
  const { logo } = await cargarAssets();
  const continuacion = pagina < paginas;

  return pintar(
    el(
      "div",
      {
        width: STORY.w,
        height: STORY.h,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
        backgroundImage: `radial-gradient(circle at 90% 4%, ${BRAND_50} 0%, #ffffff 55%)`,
        fontFamily: "Atkinson",
        paddingTop: SEGURO_SUP,
        paddingBottom: SEGURO_INF,
        paddingLeft: 90,
        paddingRight: 90,
      },
      [
        rotulo(kicker, ORANGE_DARK, 24),
        el(
          "div",
          {
            fontSize: tamNombre(titulo, 60),
            fontWeight: 700,
            color: BRAND_900,
            marginTop: 18,
            lineHeight: 1.1,
          },
          paginas > 1 ? `${titulo} (${pagina}/${paginas})` : titulo,
        ),
        el("div", { width: 90, height: 5, borderRadius: 3, backgroundColor: BRAND_100, marginTop: 30 }),
        el(
          "div",
          { display: "flex", flexDirection: "column", marginTop: 34 },
          parrafos.map((p) =>
            el("div", { fontSize: 40, color: BRAND_700, lineHeight: 1.45, marginBottom: 30 }, p),
          ),
        ),
        el("div", { display: "flex", flex: 1 }),
        el("div", { display: "flex", alignItems: "flex-end", justifyContent: "space-between" }, [
          img(logo, { width: 280 }),
          el(
            "div",
            { fontSize: 26, color: continuacion ? ORANGE_DARK : BRAND_400, fontWeight: 700 },
            continuacion ? `${T[lang].continua} →` : SITE_URL.replace("https://", ""),
          ),
        ]),
      ],
    ),
    STORY,
  );
}

/**
 * Portada de historia destacada. Instagram la recorta a un círculo centrado,
 * así que el isotipo va en el centro exacto y el título queda fuera del recorte
 * (solo se ve si la portada se sube además como historia).
 */
async function portadaDestacado({ titulo, color }) {
  const { iso } = await cargarAssets();
  return pintar(
    el(
      "div",
      {
        width: STORY.w,
        height: STORY.h,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: color,
        backgroundImage: `linear-gradient(150deg, ${color} 0%, ${BRAND_900} 130%)`,
        fontFamily: "Atkinson",
      },
      [
        el(
          "div",
          {
            display: "flex",
            width: 620,
            height: 620,
            borderRadius: 9999,
            backgroundColor: "#ffffff",
            alignItems: "center",
            justifyContent: "center",
          },
          [img(iso, { width: 360 })],
        ),
        el(
          "div",
          {
            position: "absolute",
            bottom: 300,
            width: 900,
            fontSize: 46,
            fontWeight: 700,
            color: "#ffffff",
            textAlign: "center",
          },
          titulo.toUpperCase(),
        ),
      ],
    ),
    STORY,
  );
}

/** Portada de historia de un ámbito, con su color de acento. */
async function storyAmbito({ titulo, descripcion, color, lang }) {
  const { claim } = await cargarAssets();
  return pintar(
    el(
      "div",
      {
        width: STORY.w,
        height: STORY.h,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        backgroundColor: color,
        backgroundImage: `linear-gradient(155deg, ${color} 0%, ${BRAND_900} 120%)`,
        fontFamily: "Atkinson",
        paddingTop: SEGURO_SUP,
        paddingBottom: SEGURO_INF,
        paddingLeft: 90,
        paddingRight: 90,
      },
      [
        el("div", {
          position: "absolute",
          top: -240,
          right: -220,
          width: 660,
          height: 660,
          borderRadius: 9999,
          backgroundColor: "#ffffff",
          opacity: 0.1,
        }),
        rotulo(T[lang].ambito, ORANGE, 26),
        el(
          "div",
          { fontSize: 92, fontWeight: 700, color: "#ffffff", marginTop: 30, lineHeight: 1.05 },
          titulo,
        ),
        el("div", { width: 110, height: 6, borderRadius: 3, backgroundColor: ORANGE, marginTop: 40 }),
        el(
          "div",
          { fontSize: 44, color: "#ffffff", opacity: 0.92, marginTop: 40, lineHeight: 1.4 },
          descripcion,
        ),
        el("div", { display: "flex", flex: 1 }),
        marcaEnPastilla(claim, { alinear: "flex-start" }),
      ],
    ),
    STORY,
  );
}

/** Publicación de un ámbito: título, descripción y quién lo avala. */
async function postAmbito({ titulo, descripcion, personas, color, lang }) {
  const { claim } = await cargarAssets();
  return pintar(
    el(
      "div",
      {
        width: POST.w,
        height: POST.h,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
        backgroundImage: `radial-gradient(circle at 92% 6%, ${BRAND_50} 0%, #ffffff 58%)`,
        fontFamily: "Atkinson",
        padding: 72,
      },
      [
        el("div", {
          position: "absolute",
          top: 0,
          left: 0,
          width: POST.w,
          height: 14,
          backgroundColor: color,
        }),
        rotulo(T[lang].ambito, color),
        el(
          "div",
          { fontSize: 70, fontWeight: 700, color: BRAND_900, marginTop: 26, lineHeight: 1.08 },
          titulo,
        ),
        el("div", { width: 90, height: 5, borderRadius: 3, backgroundColor: color, marginTop: 30 }),
        el(
          "div",
          { fontSize: 38, color: BRAND_700, marginTop: 30, lineHeight: 1.4 },
          descripcion,
        ),
        el("div", { display: "flex", flex: 1 }),
        el("div", { fontSize: 24, fontWeight: 700, letterSpacing: 1.6, color }, T[lang].avalan.toUpperCase()),
        el(
          "div",
          { display: "flex", flexDirection: "column", marginTop: 16 },
          personas.map((n) =>
            el("div", { fontSize: 30, color: BRAND_700, lineHeight: 1.5 }, `· ${n}`),
          ),
        ),
        img(claim, { width: 340, marginTop: 40 }),
      ],
    ),
    POST,
  );
}

/** Publicación de un artículo del blog: imagen de portada y titular. */
async function postArticulo({ titulo, descripcion, hero, lang }) {
  const { logo } = await cargarAssets();
  const altoHero = 700;
  const portada = await recortar(hero, POST.w, altoHero);

  return pintar(
    el(
      "div",
      {
        width: POST.w,
        height: POST.h,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
        fontFamily: "Atkinson",
      },
      [
        portada
          ? img(portada, { width: POST.w, height: altoHero, objectFit: "cover" })
          : el("div", {
              width: POST.w,
              height: altoHero,
              backgroundImage: `linear-gradient(135deg, ${BRAND_400}, ${BRAND_900})`,
            }),
        el(
          "div",
          {
            display: "flex",
            flexDirection: "column",
            flex: 1,
            paddingLeft: 72,
            paddingRight: 72,
            paddingTop: 48,
            paddingBottom: 44,
          },
          [
            rotulo(T[lang].noticia),
            el(
              "div",
              { fontSize: 58, fontWeight: 700, color: BRAND_900, marginTop: 22, lineHeight: 1.1 },
              titulo,
            ),
            el("div", { fontSize: 32, color: BRAND_700, marginTop: 22, lineHeight: 1.4 }, descripcion),
            el("div", { display: "flex", flex: 1 }),
            img(logo, { width: 280 }),
          ],
        ),
      ],
    ),
    POST,
  );
}

// ----------------------------------------------------------------- programa

const HASHTAGS = "#PsiCopIndartzen #Psicologia #COPBizkaia #Bizkaia #Psikologia #Elecciones2026";

async function main() {
  const argIdioma = process.argv.find((a) => a.startsWith("--lang="))?.split("=")[1];
  const idiomas = argIdioma ? [argIdioma] : IDIOMAS;
  for (const lang of idiomas) {
    if (!IDIOMAS.includes(lang)) throw new Error(`Idioma desconocido: ${lang}`);
  }

  await rm(SALIDA, { recursive: true, force: true });

  const personas = (await leerColeccion("candidatura")).sort(
    (a, b) => (a.data.order ?? 99) - (b.data.order ?? 99),
  );
  const generado = [];
  const avisos = [];

  for (const lang of idiomas) {
    const ambitos = (await leerColeccion(`ambitos/${lang}`)).sort(
      (a, b) => (a.data.order ?? 0) - (b.data.order ?? 0),
    );
    const articulos = (await leerColeccion(`blog/${lang}`)).sort(
      (a, b) => new Date(b.data.pubDate) - new Date(a.data.pubDate),
    );
    const manifiesto = (await leerColeccion(`paginas/${lang}`)).find(
      (p) => p.data.key === "manifiesto",
    );

    const pies = [];
    const nombrePorSlug = new Map(personas.map((p) => [p.slug, p.data.nombre]));

    // --- Candidatura: una publicación, una portada de historia y su trayectoria.
    for (const [i, persona] of personas.entries()) {
      const { nombre, cargo, bio } = persona.data;
      const foto = rutaDeclarada(persona.file, persona.data.image);
      const n = dosDigitos(i + 1);
      const cargoLang = cargo[lang] ?? cargo.es;

      if (!(await recortar(foto, POST.w, 880))) {
        avisos.push(`${nombre}: el retrato es demasiado pequeño; su ficha se compone sin foto.`);
      }

      generado.push(
        await guardar(
          `${lang}/posts/candidatura/${n}-${persona.slug}.jpg`,
          await postPersona({ nombre, cargo: cargoLang, foto, lang }),
        ),
      );
      generado.push(
        await guardar(
          `${lang}/stories/candidatura/${n}-${persona.slug}-1-portada.jpg`,
          await storyPersona({ nombre, cargo: cargoLang, foto, lang }),
        ),
      );

      const parrafos = (bio[lang]?.length ? bio[lang] : bio.es) ?? [];
      const paginas = paginar(parrafos);
      for (const [j, pagina] of paginas.entries()) {
        generado.push(
          await guardar(
            `${lang}/stories/candidatura/${n}-${persona.slug}-${j + 2}-cv.jpg`,
            await storyTexto({
              kicker: T[lang].trayectoria,
              titulo: nombre,
              parrafos: pagina,
              pagina: j + 1,
              paginas: paginas.length,
              lang,
            }),
          ),
        );
      }

      pies.push(
        [
          `### ${n} · ${nombre} — ${cargoLang}`,
          "",
          `**${nombre}** · ${cargoLang}`,
          "",
          parrafos[0] ?? "",
          "",
          `${SITE_URL}/${lang}/candidatura/${persona.slug}/`,
          "",
          HASHTAGS,
        ].join("\n"),
      );
    }

    // --- Ámbitos: publicación y portada de destacado.
    for (const [i, ambito] of ambitos.entries()) {
      const { key, title, description, personas: avalan = [] } = ambito.data;
      const color = COLOR_AMBITO[key] ?? BRAND_400;
      const n = dosDigitos(i + 1);
      const nombres = avalan.map((slug) => nombrePorSlug.get(slug) ?? slug);

      generado.push(
        await guardar(
          `${lang}/posts/ambitos/${n}-${key}.jpg`,
          await postAmbito({ titulo: title, descripcion: description, personas: nombres, color, lang }),
        ),
      );
      generado.push(
        await guardar(
          `${lang}/destacados/${n}-${key}.jpg`,
          await portadaDestacado({ titulo: title, color }),
        ),
      );

      // Historias que van dentro del destacado del ámbito: portada, el texto
      // del ámbito y quién lo avala.
      generado.push(
        await guardar(
          `${lang}/stories/ambitos/${n}-${key}-1-portada.jpg`,
          await storyAmbito({ titulo: title, descripcion: description, color, lang }),
        ),
      );
      const cuerpo = aTextoPlano(ambito.cuerpo)
        .split(/\n{2,}/)
        .map((p) => p.replace(/\s+/g, " ").trim())
        .filter((p) => p && !p.startsWith("#") && !p.startsWith("<"));
      const hojas = paginar(cuerpo);
      for (const [j, hoja] of hojas.entries()) {
        generado.push(
          await guardar(
            `${lang}/stories/ambitos/${n}-${key}-${j + 2}-texto.jpg`,
            await storyTexto({
              kicker: T[lang].ambito,
              titulo: title,
              parrafos: hoja,
              pagina: j + 1,
              paginas: hojas.length,
              lang,
            }),
          ),
        );
      }
      if (nombres.length > 0) {
        generado.push(
          await guardar(
            `${lang}/stories/ambitos/${n}-${key}-${hojas.length + 2}-equipo.jpg`,
            await storyTexto({
              kicker: T[lang].avalan.toUpperCase(),
              titulo: title,
              parrafos: nombres.map((nom) => `· ${nom}`),
              pagina: 1,
              paginas: 1,
              lang,
            }),
          ),
        );
      }

      pies.push(
        [
          `### Ámbito · ${title}`,
          "",
          `**${title}**`,
          "",
          description,
          "",
          `${SITE_URL}/${lang}/ambitos/${key}/`,
          "",
          HASHTAGS,
        ].join("\n"),
      );
    }

    // --- Destacados generales.
    generado.push(
      await guardar(
        `${lang}/destacados/00-candidatura.jpg`,
        await portadaDestacado({ titulo: T[lang].equipo, color: BRAND_900 }),
      ),
    );
    generado.push(
      await guardar(
        `${lang}/destacados/${dosDigitos(ambitos.length + 1)}-manifiesto.jpg`,
        await portadaDestacado({ titulo: T[lang].manifiesto, color: ORANGE_DARK }),
      ),
    );

    // --- Manifiesto en historias.
    if (manifiesto) {
      const parrafos = aTextoPlano(manifiesto.cuerpo)
        .split(/\n{2,}/)
        .map((p) => p.replace(/\s+/g, " ").trim())
        .filter((p) => p && !p.startsWith("#") && !p.startsWith("<"));
      const paginas = paginar(parrafos);
      for (const [j, pagina] of paginas.entries()) {
        generado.push(
          await guardar(
            `${lang}/stories/manifiesto/${dosDigitos(j + 1)}.jpg`,
            await storyTexto({
              kicker: T[lang].manifiesto,
              titulo: manifiesto.data.title,
              parrafos: pagina,
              pagina: j + 1,
              paginas: paginas.length,
              lang,
            }),
          ),
        );
      }
    }

    // --- Artículos del blog.
    for (const [i, articulo] of articulos.entries()) {
      const { title, description, key, pubDate } = articulo.data;
      const hero = rutaDeclarada(articulo.file, articulo.data.heroImage);
      const n = dosDigitos(i + 1);
      generado.push(
        await guardar(
          `${lang}/posts/articulos/${n}-${articulo.slug}.jpg`,
          await postArticulo({ titulo: title, descripcion: description, hero, lang }),
        ),
      );
      pies.push(
        [
          `### Noticia · ${title}`,
          "",
          `**${title}**`,
          "",
          description,
          "",
          `${SITE_URL}/${lang}/noticias/${key ?? articulo.slug}/`,
          "",
          HASHTAGS,
          "",
          `_Publicado el ${new Date(pubDate).toLocaleDateString(lang === "eu" ? "eu-ES" : "es-ES")}_`,
        ].join("\n"),
      );
    }

    await guardar(
      `${lang}/pies.md`,
      Buffer.from(
        [
          `# Pies de foto — ${lang === "eu" ? "euskera" : "castellano"}`,
          "",
          "Textos listos para copiar en cada publicación. El orden coincide con la",
          "numeración de los archivos de `posts/`.",
          "",
          ...pies.flatMap((p) => [p, "", "---", ""]),
        ].join("\n"),
        "utf8",
      ),
    );
  }

  // --- Carpeta de subida al móvil, que es donde hay que hacer las historias.
  //
  // Los destacados solo se pueden montar desde el teléfono, y el carrete ordena
  // por fecha de captura: se reescribe una fecha creciente en cada archivo para
  // que lleguen ya en el orden de publicación y se puedan seleccionar en bloque.
  if (idiomas.includes("es")) {
    // Un destacado por ámbito, en el orden en que se publican, y detrás los dos
    // generales. Se deriva del contenido para que añadir un ámbito no obligue a
    // tocar esta lista.
    const ambitosEs = (await leerColeccion("ambitos/es")).sort(
      (a, b) => (a.data.order ?? 0) - (b.data.order ?? 0),
    );
    const tandas = [
      ...ambitosEs.map((ambito, i) => ({
        carpeta: `${i + 1}-${ambito.data.key}`,
        portada: `${dosDigitos(i + 1)}-${ambito.data.key}`,
        historias: `${dosDigitos(i + 1)}-${ambito.data.key}`,
        origen: "es/stories/ambitos",
      })),
      {
        carpeta: `${ambitosEs.length + 1}-manifiesto`,
        portada: `${dosDigitos(ambitosEs.length + 1)}-manifiesto`,
        historias: null,
        origen: "es/stories/manifiesto",
      },
      {
        carpeta: `${ambitosEs.length + 2}-candidatura`,
        portada: "00-candidatura",
        historias: null,
        origen: "es/stories/candidatura",
      },
    ];

    // Una tanda por día para que dos destacados no se entremezclen en el carrete.
    const base = new Date("2026-01-01T09:00:00Z");
    let dia = 0;

    for (const tanda of tandas) {
      const origen = path.join(SALIDA, tanda.origen);
      const todos = (await readdir(origen)).filter((f) => f.endsWith(".jpg")).sort();
      const suyos = tanda.historias ? todos.filter((f) => f.startsWith(tanda.historias)) : todos;

      const destino = path.join(SALIDA, "movil", tanda.carpeta);
      await mkdir(destino, { recursive: true });

      // La portada del destacado no se publica como historia: se elige después
      // en «Editar portada», pero tiene que estar en el carrete igualmente, y
      // justo delante de sus historias.
      const antes = new Date(base.getTime() + dia * 86400000 - 60000);
      const rutaPortada = path.join(destino, "00-portada-del-destacado.jpg");
      await sharp(path.join(SALIDA, `es/destacados/${tanda.portada}.jpg`))
        .withExif({
          IFD0: { DateTime: marcaExif(antes) },
          ExifIFD: { DateTimeOriginal: marcaExif(antes) },
        })
        .toFile(rutaPortada);
      await utimes(rutaPortada, antes, antes);

      for (const [i, archivo] of suyos.entries()) {
        const cuando = new Date(base.getTime() + dia * 86400000 + i * 60000);
        const marca = marcaExif(cuando);
        const nombre = `${dosDigitos(i + 1)}-${archivo}`;
        const ruta = path.join(destino, nombre);
        await sharp(path.join(origen, archivo))
          .withExif({ IFD0: { DateTime: marca }, ExifIFD: { DateTimeOriginal: marca } })
          .toFile(ruta);
        await utimes(ruta, cuando, cuando);
      }
      dia += 1;
      generado.push(`movil/${tanda.carpeta}/ (${suyos.length + 1} archivos)`);
    }
  }

  const guia = [
    "# Materiales para Instagram",
    "",
    "Generado con `node scripts/instagram.mjs` a partir de `src/content/`.",
    "Al volver a ejecutarlo la carpeta se rehace entera, así que no edites nada aquí:",
    "cambia el contenido en `src/content/` y regenera.",
    "",
    "## Qué hay",
    "",
    "```text",
    "instagram/<es|eu>/",
    "├── posts/candidatura/   1080×1350 · una publicación por persona",
    "├── posts/ambitos/       1080×1350 · un ámbito por publicación",
    "├── posts/articulos/     1080×1350 · las noticias del blog",
    "├── stories/candidatura/ 1080×1920 · portada + trayectoria de cada persona",
    "├── stories/manifiesto/  1080×1920 · el manifiesto por entregas",
    "├── destacados/          1080×1920 · portadas de historias destacadas",
    "└── pies.md              los textos de cada publicación",
    "```",
    "",
    "## Las historias hay que subirlas desde el móvil",
    "",
    "Instagram web solo permite publicar en el feed: no deja subir historias, y un",
    "destacado únicamente se monta con historias ya publicadas. La API de Meta",
    "tampoco expone los destacados. Así que esta parte es a mano, sí o sí.",
    "",
    "En `movil/` está cada destacado en su carpeta, con los archivos numerados en",
    "el orden de publicación y con la fecha de captura reescrita de forma creciente,",
    "para que al pasarlos al teléfono lleguen ya ordenados en el carrete.",
    "",
    "Para cada carpeta:",
    "",
    "1. Pasa la carpeta al móvil (AirDrop, Fotos, Drive…).",
    "2. Publica como historia los archivos `01-…` en adelante. Se pueden",
    "   seleccionar todos a la vez.",
    "3. En el perfil, **+ Nuevo** debajo de la biografía, selecciona esas historias",
    "   y ponle nombre al destacado.",
    "4. **Editar destacado → Editar portada → 🖼️** y elige",
    "   `00-portada-del-destacado.jpg`, que no se publica como historia. Instagram",
    "   recorta la portada a un círculo centrado: por eso el isotipo va en el",
    "   centro exacto.",
    "",
    "Las historias caducan a las 24 h, pero las que están en un destacado siguen",
    "visibles. Si prefieres no tenerlas en el perfil, súbelas igual y borra después",
    "la historia: el destacado se mantiene.",
    "",
    "## Publicaciones del feed",
    "",
    "Esto sí se puede hacer desde el ordenador, en instagram.com. Los archivos de",
    "`posts/candidatura/` van numerados en orden protocolario, así que se pueden",
    "subir como carrusel único o de una en una; los pies están en `pies.md` con el",
    "mismo número. Al subirlos, elige **Original** en el selector de recorte: por",
    "defecto Instagram recorta a 1:1 y se come el logotipo.",
    "",
  ].join("\n");
  await guardar("LEEME.md", Buffer.from(guia, "utf8"));

  console.log(`\n${generado.length + 1} archivos en ./instagram/`);
  const porCarpeta = new Map();
  for (const f of generado) {
    const dir = path.dirname(f);
    porCarpeta.set(dir, (porCarpeta.get(dir) ?? 0) + 1);
  }
  for (const [dir, n] of [...porCarpeta].sort()) console.log(`  ${String(n).padStart(3)}  ${dir}`);
  if (avisos.length > 0) {
    console.log("\nAvisos:");
    for (const a of [...new Set(avisos)]) console.log(`  · ${a}`);
  }
}

await main();
