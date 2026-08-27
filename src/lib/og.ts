// Generación de las imágenes Open Graph (1200×630) que se comparten en redes.
//
// Se resuelven en tiempo de build: satori maqueta la tarjeta y convierte el
// texto a trazados (no depende de las fuentes del sistema donde se compila) y
// sharp rasteriza el SVG resultante a JPEG.
import { readFile } from "node:fs/promises";
import path from "node:path";
import satori from "satori";
import sharp from "sharp";
import { ELECTION_YEAR } from "../consts";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

// Paleta de marca (espejo de los tokens de src/styles/global.css).
const BRAND_900 = "#093671";
const BRAND_400 = "#0085C9";
const BRAND_100 = "#D6E6F3";
const BRAND_50 = "#F1F7FC";
const GREEN_DARK = "#208C40";
const ORANGE = "#F79B1F";
const ORANGE_DARK = "#E46122";

const FOTO_W = 372;
const FOTO_H = 512;

const fromRoot = (...segments: string[]) => path.resolve(process.cwd(), ...segments);

// Las fuentes y el logotipo son los mismos en todas las tarjetas: se leen y se
// rasterizan una sola vez por build.
let assets: Promise<{ fonts: { name: string; data: Buffer; weight: 400 | 700; style: "normal" }[]; logo: string }> | null = null;

function loadAssets() {
  assets ??= (async () => {
    const [regular, bold, logoSvg] = await Promise.all([
      readFile(fromRoot("src/assets/fonts/atkinson-regular.woff")),
      readFile(fromRoot("src/assets/fonts/atkinson-bold.woff")),
      readFile(fromRoot("src/assets/brand/logotipo-claim.svg")),
    ]);
    // El logotipo se rasteriza aparte: satori solo admite mapas de bits.
    const logo = await sharp(logoSvg).resize({ width: 640 }).png().toBuffer();
    return {
      fonts: [
        { name: "Atkinson", data: regular, weight: 400 as const, style: "normal" as const },
        { name: "Atkinson", data: bold, weight: 700 as const, style: "normal" as const },
      ],
      logo: dataUri(logo, "image/png"),
    };
  })();
  return assets;
}

const dataUri = (buffer: Buffer, mime: string) => `data:${mime};base64,${buffer.toString("base64")}`;

/** Recorta la fotografía al formato del panel priorizando la zona con el rostro. */
async function recortarFoto(file: string) {
  const buffer = await sharp(await readFile(file))
    .resize(FOTO_W, FOTO_H, { fit: "cover", position: sharp.strategy.attention })
    .jpeg({ quality: 82 })
    .toBuffer();
  return dataUri(buffer, "image/jpeg");
}

// Pequeño ayudante para construir el árbol que espera satori sin usar JSX.
type Node = { type: string; props: Record<string, unknown> };
const el = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({
  type,
  props: children === undefined ? { style } : { style, children },
});

export interface PersonaOgOptions {
  nombre: string;
  cargo: string;
  /** Ruta absoluta al retrato. Si falta, la tarjeta se compone sin foto. */
  foto?: string;
  lang: "es" | "eu";
}

export async function renderPersonaOg({ nombre, cargo, foto, lang }: PersonaOgOptions) {
  const { fonts, logo } = await loadAssets();
  const retrato = foto ? await recortarFoto(foto) : null;
  const eyebrow = lang === "eu" ? `HAUTAGAITZA · COP BIZKAIA ${ELECTION_YEAR}` : `CANDIDATURA · COP BIZKAIA ${ELECTION_YEAR}`;
  // El nombre encoge cuando es largo para que nunca se corte a dos líneas apretadas.
  const nombreSize = nombre.length > 26 ? 46 : nombre.length > 18 ? 54 : 62;

  const svg = await satori(
    el(
      "div",
      {
        width: OG_WIDTH,
        height: OG_HEIGHT,
        display: "flex",
        alignItems: "center",
        backgroundColor: "#ffffff",
        backgroundImage: `radial-gradient(circle at 12% 0%, ${BRAND_50} 0%, #ffffff 55%)`,
        fontFamily: "Atkinson",
        padding: 56,
      },
      [
        // Mancha de color de fondo, el mismo recurso decorativo que usa el sitio.
        el("div", {
          position: "absolute",
          top: -180,
          right: -140,
          width: 460,
          height: 460,
          borderRadius: 9999,
          backgroundColor: BRAND_100,
          opacity: 0.55,
        }),
        // Panel de la fotografía, con el marco degradado girado de su ficha.
        el(
          "div",
          { display: "flex", position: "relative", width: FOTO_W, height: FOTO_H, flexShrink: 0 },
          [
            el("div", {
              position: "absolute",
              top: -12,
              left: -12,
              width: FOTO_W + 24,
              height: FOTO_H + 24,
              borderRadius: 34,
              backgroundImage: `linear-gradient(135deg, ${BRAND_400}, ${BRAND_900})`,
              transform: "rotate(-2.5deg)",
            }),
            retrato
              ? {
                  type: "img",
                  props: {
                    src: retrato,
                    width: FOTO_W,
                    height: FOTO_H,
                    style: { borderRadius: 26, objectFit: "cover" },
                  },
                }
              : el(
                  "div",
                  {
                    display: "flex",
                    width: FOTO_W,
                    height: FOTO_H,
                    borderRadius: 26,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundImage: `linear-gradient(135deg, ${BRAND_50}, ${BRAND_100})`,
                    color: BRAND_400,
                    fontSize: 120,
                    fontWeight: 700,
                  },
                  nombre.charAt(0),
                ),
          ],
        ),
        // Bloque de texto.
        el(
          "div",
          { display: "flex", flexDirection: "column", flex: 1, paddingLeft: 60, paddingRight: 8 },
          [
            el("div", { display: "flex", alignItems: "center" }, [
              el("div", { width: 40, height: 4, borderRadius: 2, backgroundColor: ORANGE, marginRight: 14 }),
              el(
                "div",
                { fontSize: 19, fontWeight: 700, letterSpacing: 2.5, color: ORANGE_DARK },
                eyebrow,
              ),
            ]),
            el(
              "div",
              { fontSize: nombreSize, fontWeight: 700, color: BRAND_900, lineHeight: 1.08, marginTop: 22 },
              nombre,
            ),
            el("div", { fontSize: 30, fontWeight: 700, color: GREEN_DARK, marginTop: 12 }, cargo),
            el("div", { width: 72, height: 5, borderRadius: 3, backgroundColor: BRAND_100, marginTop: 34 }),
            {
              type: "img",
              props: { src: logo, width: 300, style: { marginTop: 34 } },
            },
          ],
        ),
      ],
    ) as never,
    { width: OG_WIDTH, height: OG_HEIGHT, fonts },
  );

  return sharp(Buffer.from(svg)).jpeg({ quality: 86, chromaSubsampling: "4:4:4" }).toBuffer();
}

/**
 * Ruta en disco del retrato declarado en el frontmatter de una entrada.
 *
 * `ImageMetadata` solo expone la URL ya procesada por Astro, así que para
 * poder recomponer la imagen con sharp se resuelve la ruta original a partir
 * del propio Markdown.
 */
export async function rutaImagenDeEntrada(filePath: string | undefined) {
  if (!filePath) return undefined;
  const md = await readFile(fromRoot(filePath), "utf8");
  const declarada = md.match(/^image:\s*["']?(.+?)["']?\s*$/m)?.[1];
  return declarada ? path.resolve(path.dirname(fromRoot(filePath)), declarada) : undefined;
}
