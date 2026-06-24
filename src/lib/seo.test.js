// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyPageSeo, getSiteUrl, resolveSeoForPath } from './seo';

describe('seo helpers', () => {
  it('resolves static route metadata', () => {
    const seo = resolveSeoForPath('/characters');
    expect(seo.title).toContain('Персонажи');
    expect(seo.noindex).toBe(false);
  });

  it('marks auth callback as noindex', () => {
    const seo = resolveSeoForPath('/auth/callback');
    expect(seo.noindex).toBe(true);
  });

  it('resolves character page title', () => {
    const seo = resolveSeoForPath('/character/venti');
    expect(seo.title).toContain('Венти');
    expect(seo.description).toContain('Венти');
  });

  it('uses configured site url', () => {
    expect(getSiteUrl({ VITE_SITE_URL: 'https://example.com/' })).toBe('https://example.com');
  });

  it('updates document metadata', () => {
    document.head.innerHTML = '';
    applyPageSeo({
      title: 'Команда и расчёт DPS',
      description: 'Тестовое описание',
      pathname: '/team',
      siteUrl: 'https://example.com',
    });

    expect(document.title).toContain('Команда');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content'))
      .toBe('Тестовое описание');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href'))
      .toBe('https://example.com/team');
  });
});
