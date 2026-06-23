/**
 * Supabase Auth Hook: before-user-created
 * Блокирует регистрацию через Google/Apple для IP из России.
 *
 * Dashboard → Authentication → Hooks → before-user-created → URL этой функции.
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const BLOCKED_COUNTRIES = new Set(['RU']);
const OAUTH_PROVIDERS = new Set(['google', 'apple']);

function normalizeCountry(code: string | null | undefined): string | null {
  if (!code) return null;
  const trimmed = code.trim().toUpperCase();
  return trimmed.length === 2 ? trimmed : null;
}

async function lookupCountry(ip: string | null | undefined): Promise<string | null> {
  if (!ip) return null;

  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,countryCode`);
    if (!response.ok) return null;
    const payload = await response.json();
    if (payload.status !== 'success') return null;
    return normalizeCountry(payload.countryCode);
  } catch {
    return null;
  }
}

function resolveOAuthProvider(user: Record<string, unknown>): string | null {
  const identities = user.identities;
  if (!Array.isArray(identities) || identities.length === 0) return null;
  const provider = identities[0]?.provider;
  return typeof provider === 'string' ? provider.toLowerCase() : null;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({
      error: { http_code: 400, message: 'Invalid JSON' },
    }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const user = (payload.user || {}) as Record<string, unknown>;
  const metadata = (payload.metadata || {}) as Record<string, unknown>;
  const provider = resolveOAuthProvider(user);

  if (!provider || !OAUTH_PROVIDERS.has(provider)) {
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const ip = typeof metadata.ip_address === 'string' ? metadata.ip_address : null;
  const country = await lookupCountry(ip);

  if (country && BLOCKED_COUNTRIES.has(country)) {
    return new Response(JSON.stringify({
      error: {
        http_code: 403,
        message: 'Регистрация через Google и Apple недоступна из России. Используйте email.',
      },
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
