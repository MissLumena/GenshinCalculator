/**
 * Cloudflare Worker: статика из dist/ + прокси /api/* на Render (API_ORIGIN).
 */

export default {
  /**
   * @param {Request} request
   * @param {{ ASSETS: { fetch: (req: Request) => Promise<Response> }; API_ORIGIN?: string }} env
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    const apiOrigin = (env.API_ORIGIN || '').trim().replace(/\/$/, '');

    if (apiOrigin && url.pathname.startsWith('/api/')) {
      const target = `${apiOrigin}${url.pathname}${url.search}`;
      return fetch(
        new Request(target, {
          method: request.method,
          headers: request.headers,
          body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
          redirect: 'manual',
        }),
      );
    }

    return env.ASSETS.fetch(request);
  },
};
