import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { SITE, SITE_NAME, LOCALES } from "../consts";

export function getStaticPaths() {
  return LOCALES.map((lang) => ({ params: { lang } }));
}

export async function GET(context) {
  const { lang } = context.params;
  const noticias = await getCollection("blog", (n) => n.data.lang === lang);
  return rss({
    title: SITE_NAME,
    description: SITE[lang].description,
    site: context.site,
    items: noticias
      .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
      .map((n) => ({
        title: n.data.title,
        description: n.data.description,
        pubDate: n.data.pubDate,
        link: `/${lang}/noticias/${n.id.split("/").pop()}/`,
      })),
  });
}
