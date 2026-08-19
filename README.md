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

- Fotografías de retrato de 6 integrantes (y la de Ana Sanz llega a 212×320 px).
- Cargo de Marije Goikoetxea Iturregui.
- Traducción al euskera de las biografías y del manifiesto.
- Datos de contacto y redes sociales (`CONTACT` en `src/consts.ts`).
- Dominio definitivo (`site` en `astro.config.mjs`).
- Backend del formulario de contacto y aviso de protección de datos.

## Comandos

| Comando | Acción |
| :--- | :--- |
| `npm install` | Instala las dependencias |
| `npm run dev` | Servidor local en `localhost:4321` |
| `npm run build` | Compila el sitio en `./dist/` |
| `npm run preview` | Previsualiza la compilación |
