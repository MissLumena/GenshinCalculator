/** Прокси /api/* → Render (Pages Functions; _redirects не умеет внешние URL). */
const API_ORIGIN = 'https://genshincalculator-l6rw.onrender.com';

/**
 * @param {import('@cloudflare/workers-types').EventContext} context
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const target = `${API_ORIGIN}${url.pathname}${url.search}`;
  const method = context.request.method;

  return fetch(
    new Request(target, {
      method,
      headers: context.request.headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : context.request.body,
      redirect: 'manual',
    }),
  );
}
