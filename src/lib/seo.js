import { findCharacterById } from '../characters';

export const SITE_NAME = 'Genshin Calculator';
export const DEFAULT_SITE_URL = 'https://genshin-calculator-2ow.pages.dev';
export const DEFAULT_DESCRIPTION =
  'Калькулятор DPS для Genshin Impact: соберите команду, настройте артефакты и таланты, рассчитайте урон персонажей и сохраните результаты.';

const ROUTE_SEO = {
  '/': {
    title: 'Калькулятор DPS Genshin Impact',
    description:
      'Бесплатный калькулятор DPS Genshin Impact: персонажи, артефакты, команда и расчёт урона онлайн.',
  },
  '/characters': {
    title: 'Персонажи Genshin Impact',
    description:
      'Список персонажей Genshin Impact с настройкой билда, артефактов, талантов и расчётом DPS.',
  },
  '/team': {
    title: 'Команда и расчёт DPS',
    description:
      'Соберите команду из четырёх персонажей и рассчитайте суммарный DPS в Genshin Impact.',
  },
  '/results': {
    title: 'Результаты расчётов DPS',
    description:
      'Публичные результаты расчётов DPS команд игроков Genshin Impact.',
  },
};

const NOINDEX_PREFIXES = ['/auth/', '/results/'];

export function getSiteUrl(env = import.meta.env) {
  const raw = String(env.VITE_SITE_URL || '').trim();
  return (raw || DEFAULT_SITE_URL).replace(/\/$/, '');
}

export function resolveSeoForPath(pathname) {
  const normalized = pathname.split('?')[0].split('#')[0] || '/';
  const noindex = NOINDEX_PREFIXES.some((prefix) => normalized.startsWith(prefix));

  if (normalized.startsWith('/character/')) {
    const characterId = normalized.split('/')[2] || '';
    const character = characterId ? findCharacterById(characterId) : null;
    if (character) {
      return {
        title: `${character.nameRu} — билд и DPS`,
        description: `Настройка билда, артефактов и расчёт DPS для ${character.nameRu} в Genshin Impact.`,
        pathname: normalized,
        noindex: false,
      };
    }
  }

  const staticSeo = ROUTE_SEO[normalized];
  if (staticSeo) {
    return { ...staticSeo, pathname: normalized, noindex };
  }

  return {
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    pathname: normalized,
    noindex,
  };
}

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
  return element;
}

function upsertLink(rel, href) {
  let element = document.head.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
  return element;
}

export function applyPageSeo({
  title,
  description,
  pathname = '/',
  noindex = false,
  siteUrl = getSiteUrl(),
}) {
  const pageTitle = title && title !== SITE_NAME ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const canonicalUrl = `${siteUrl}${pathname === '/' ? '' : pathname}`;
  const imageUrl = `${siteUrl}/apple-touch-icon.png`;

  document.title = pageTitle;

  upsertMeta('meta[name="description"]', { name: 'description', content: description });
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: pageTitle });
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
  upsertMeta('meta[property="og:image"]', { property: 'og:image', content: imageUrl });
  upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'ru_RU' });
  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary' });
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: pageTitle });
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
  upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: imageUrl });
  upsertMeta('meta[name="robots"]', {
    name: 'robots',
    content: noindex ? 'noindex, nofollow' : 'index, follow',
  });

  upsertLink('canonical', canonicalUrl);
}

export function applyRouteSeo(pathname, env = import.meta.env) {
  const seo = resolveSeoForPath(pathname);
  applyPageSeo({ ...seo, siteUrl: getSiteUrl(env) });
  return seo;
}
