const DEFAULT_FRONTEND_APP_URL = 'http://localhost:5176';

function getFrontendOrigin(): string {
  const raw = String(process.env.FRONTEND_APP_URL || DEFAULT_FRONTEND_APP_URL).trim();
  if (!raw) {
    return new URL(DEFAULT_FRONTEND_APP_URL).origin;
  }

  if (raw.includes(',')) {
    throw new Error('FRONTEND_APP_URL must be a single URL.');
  }

  const normalized = new URL(raw);
  if (normalized.pathname === '/api' || normalized.pathname.startsWith('/api/')) {
    throw new Error('FRONTEND_APP_URL must not include /api.');
  }

  return normalized.origin;
}

export function sanitizeSuggestionComment(value: unknown): string {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function validateSuggestionTargetUrl(value?: string | null): string | undefined {
  const raw = String(value || '').trim();
  if (!raw) {
    return undefined;
  }

  if (raw.includes(',')) {
    throw new Error('Target URL must be a single URL.');
  }

  if (raw.startsWith('/')) {
    if (raw.startsWith('//')) {
      throw new Error('Target URL must be a relative frontend path or a URL from this app only.');
    }

    if (raw.toLowerCase().startsWith('/api')) {
      throw new Error('Target URL must not point to API routes.');
    }

    return raw;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Target URL must be a relative path or a valid frontend URL.');
  }

  const frontendOrigin = getFrontendOrigin();
  if (parsed.origin !== frontendOrigin) {
    throw new Error('Target URL must belong to this application only.');
  }

  if (parsed.pathname.toLowerCase() === '/api' || parsed.pathname.toLowerCase().startsWith('/api/')) {
    throw new Error('Target URL must not point to API routes.');
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}