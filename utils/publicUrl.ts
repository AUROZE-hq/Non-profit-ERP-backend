const DEFAULT_FRONTEND_APP_URL = 'http://localhost:5176';

function ensureNoApiPath(url: URL) {
  const pathname = (url.pathname || '').toLowerCase();
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    throw new Error('FRONTEND_APP_URL must not include /api.');
  }
}

export function normalizePublicAppUrl(rawValue?: string): string {
  const raw = String(rawValue || DEFAULT_FRONTEND_APP_URL).trim();

  if (!raw) {
    throw new Error('FRONTEND_APP_URL is required.');
  }

  if (raw.includes(',')) {
    throw new Error('FRONTEND_APP_URL must be a single URL and cannot be comma-separated.');
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('FRONTEND_APP_URL must be a valid absolute URL (for example: http://localhost:5176).');
  }

  ensureNoApiPath(parsed);

  const normalized = `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
  if (!normalized) {
    throw new Error('FRONTEND_APP_URL normalization failed.');
  }

  return normalized;
}

export function getFrontendAppUrl(): string {
  return normalizePublicAppUrl(process.env.FRONTEND_APP_URL);
}

export function buildPublicSignUrl(token: string): string {
  if (!token || typeof token !== 'string') {
    throw new Error('A valid signing token is required to build sign URL.');
  }
  return `${getFrontendAppUrl()}/sign/${encodeURIComponent(token)}`;
}
