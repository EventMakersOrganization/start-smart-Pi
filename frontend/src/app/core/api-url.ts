import { environment } from '../../environments/environment';

/**
 * HTTP API paths. In production (apiOrigin empty) returns same-origin paths for nginx → backend proxy.
 */
export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  const base = environment.apiOrigin;
  return base ? `${base}${p}` : p;
}

/**
 * Socket.IO base URL: dev uses Nest directly; prod uses the SPA origin (nginx proxies /socket.io).
 */
export function socketBaseUrl(): string {
  if (environment.apiOrigin) {
    return environment.apiOrigin;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
}

/**
 * For template literals that built `http://localhost:3000${path}` (path usually starts with /).
 */
export function publicApiOrigin(): string {
  return socketBaseUrl();
}

/**
 * Static or API-relative media URLs in dev vs same-origin in prod.
 */
export function assetUrl(path: string): string {
  if (!path) return path;
  if (path.startsWith('http')) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${socketBaseUrl()}${p}`;
}
