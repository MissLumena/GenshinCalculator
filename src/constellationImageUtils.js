const WIKIA_HOSTS = ['nocookie.net', 'fandom.com'];

function isWikiaHost(hostname) {
  const host = hostname.toLowerCase();
  return WIKIA_HOSTS.some((part) => host.includes(part));
}

/** Преобразует URL силуэта для загрузки в браузере (обход блокировки Fandom по Referer). */
export function prepareConstellationImageUrl(url) {
  if (!url || typeof url !== 'string') return null;

  try {
    const parsed = new URL(url);

    if (isWikiaHost(parsed.hostname) && typeof window !== 'undefined') {
      const path = `${parsed.pathname}${parsed.search}`;
      if (import.meta.env?.DEV) {
        return `/constellation-img${path}`;
      }
      return `/api/media/wikia-image?${new URLSearchParams({ path })}`;
    }
  } catch {
    return url;
  }

  return url;
}

export function prepareConstellationImageCandidates(urls = []) {
  return [...new Set(
    urls
      .map((url) => prepareConstellationImageUrl(url))
      .filter(Boolean),
  )];
}
