# PsiCopIndartzen

Web de la candidatura **PsiCopIndartzen** a la Junta de Gobierno del Colegio Oficial
de Psicología de Bizkaia (COPB) en las elecciones de 2026.

Construida con Astro 7, Tailwind CSS 4 y DaisyUI, sobre el template
[HealNet](https://github.com/anastasiiaxfr/HealNet).

## Idiomas

El sitio es bilingüe castellano/euskera mediante el enrutado i18n de Astro:

- `/es/…` — castellano (idioma por defecto; `/` redirige aquí)
- `/eu/…` — euskera

Las cadenas de interfaz están en `src/i18n/ui.ts`. El contenido largo vive en
colecciones, con un archivo por idioma.

## Estructura del contenido

```text
src/content/
├── ambitos/{es,eu}/     Ámbitos de la Psicología (jurídica, clínica, educación, social)
├── candidatura/         Una ficha por persona, con `cargo` y `bio` bilingües
├── paginas/{es,eu}/     Textos largos (manifiesto)
└── blog/{es,eu}/        Noticias de campaña
```

Las biografías tienen `bio.es` y `bio.eu`. Mientras `bio.eu` esté vacío, la ficha
en euskera muestra el texto en castellano con un aviso.

## Rutas

| Ruta | Contenido |
| :--- | :--- |
| `/{lang}/` | Portada: manifiesto, ámbitos y Junta de Gobierno |
| `/{lang}/candidatura/` | Listado completo del equipo |
| `/{lang}/candidatura/{persona}/` | Ficha individual |
| `/{lang}/ambitos/` | Los cuatro ámbitos |
| `/{lang}/ambitos/{ambito}/` | Texto del ámbito y personas que lo avalan |
| `/{lang}/noticias/` | Noticias paginadas |
| `/{lang}/contacto/` | Formulario de contacto |
| `/rss-{lang}.xml` | RSS por idioma |

## Identidad de marca

Los logotipos están en `src/assets/brand/`:

| Archivo | Uso |
| :--- | :--- |
| `isotipo.svg` | Solo la Ψ. Origen de los favicons |
| `logotipo.svg` | Isotipo + nombre. Cabecera y menú móvil |
| `logotipo-claim.svg` | Añade el lema bilingüe. Pie de página e imagen Open Graph |

`Logo.astro` los sirve mediante la prop `variant` (`"simple"` o `"claim"`).

La paleta se define en `src/styles/global.css`, bajo `@theme`, tomada del propio
logotipo:

| Token | Color | Papel |
| :--- | :--- | :--- |
| `brand-700` | `#073B6C` | Azul marino: texto, titulares, enlaces |
| `brand-400` | `#0085C9` | Azul medio: degradados y botones |
| `accent-green` | `#5A9C29` | Verde de «Indartzen»: cargos y acentos |
| `accent-orange` | `#F79B1F` | Naranja de la flecha: llamada a la acción principal |

Los favicons y la imagen Open Graph se generan a partir del isotipo; si el
logotipo cambia, hay que regenerarlos.

## Pendiente

Busca los comentarios `TODO:` en el código. En resumen:

Pendiente de la candidatura:

- Cargo de Marije Goikoetxea Iturregui (el resto ya están confirmados).
- Validación de los textos de los ámbitos de Organizaciones y Deporte, redactados
  a partir de la reunión y marcados con `TODO` en `src/content/ambitos/`.
- Datos de contacto y redes sociales (`CONTACT` en `src/consts.ts`): de momento
  solo hay Instagram.
- Revisión del euskera por una persona euskaldun: biografías, manifiesto, las
  noticias y las cadenas de interfaz (`src/i18n/ui.ts`).
- Responsable del tratamiento de datos, para el aviso legal y la política de
  privacidad.

Pendiente de desarrollo:

- Backend del formulario de contacto y aviso de protección de datos.
- Páginas de aviso legal y política de privacidad: las cadenas están en
  `src/i18n/ui.ts` (`footer.aviso`, `footer.privacidad`) pero no hay página ni
  enlace en el pie.

## Materiales para Instagram

`npm run instagram` compone, a partir del mismo contenido de `src/content/`, las
publicaciones y las historias de la campaña en `./instagram/` (carpeta ignorada
por git, se rehace en cada ejecución):

| Carpeta | Formato | Contenido |
| :--- | :--- | :--- |
| `posts/candidatura/` | 1080×1350 | Una publicación por integrante |
| `posts/ambitos/` | 1080×1350 | Un ámbito por publicación |
| `posts/articulos/` | 1080×1350 | Las noticias del blog |
| `stories/candidatura/` | 1080×1920 | Portada y trayectoria de cada integrante |
| `stories/manifiesto/` | 1080×1920 | El manifiesto por entregas |
| `destacados/` | 1080×1920 | Portadas de historias destacadas |
| `pies.md` | — | El texto de cada publicación |
| `movil/` | — | Un destacado por carpeta, listo para pasar al teléfono |

Todo se genera en castellano y en euskera. La maquetación reutiliza el mismo
motor que las imágenes Open Graph (`src/lib/og.ts`): satori más sharp, con las
fuentes Atkinson y la paleta de marca.

El feed se puede publicar desde instagram.com, eligiendo **Original** en el
selector de recorte. Las historias no: Instagram web no permite subirlas y un
destacado solo se monta con historias ya publicadas, así que esa parte va desde
el móvil. Por eso `movil/` agrupa cada destacado en su carpeta, con los archivos
numerados y con la fecha de captura reescrita de forma creciente, para que
lleguen ordenados al carrete. `instagram/LEEME.md` detalla el procedimiento.

## Comandos

| Comando | Acción |
| :--- | :--- |
| `npm install` | Instala las dependencias |
| `npm run dev` | Servidor local en `localhost:4321` |
| `npm run build` | Compila el sitio en `./dist/` |
| `npm run preview` | Previsualiza la compilación |
| `npm run instagram` | Genera en `./instagram/` los materiales para Instagram |
