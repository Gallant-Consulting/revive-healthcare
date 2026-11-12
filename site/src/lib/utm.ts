/**
 * Campaign codes (UTM) from the link someone arrived by. They're remembered for the rest of
 * the visit, so a sign-up still carries them after the person browses to another page.
 * Session storage is per browser tab and clears when the tab closes.
 */
export interface Utm {
  source: string | null;
  medium: string | null;
  campaign: string | null;
}

const STORAGE_KEY = 'revive:utm';
const MAX_LENGTH = 200;

const clean = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, MAX_LENGTH) : null;

function fromUrl(): Utm | null {
  const params = new URLSearchParams(window.location.search);
  const utm = {
    source: clean(params.get('utm_source')),
    medium: clean(params.get('utm_medium')),
    campaign: clean(params.get('utm_campaign')),
  };
  return utm.source || utm.medium || utm.campaign ? utm : null;
}

/** Saves the current page's UTM codes for the rest of the visit. Runs on every page. */
export function rememberUtm(): void {
  const utm = fromUrl();
  if (!utm) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(utm));
  } catch {
    // Storage blocked (private mode, disabled cookies): codes still work on the landing page.
  }
}

/** UTM codes from the current page's URL, or else the ones remembered earlier in the visit. */
export function currentUtm(): Utm {
  const utm = fromUrl();
  if (utm) return utm;
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      return { source: clean(saved.source), medium: clean(saved.medium), campaign: clean(saved.campaign) };
    }
  } catch {
    // Missing or unreadable: no codes.
  }
  return { source: null, medium: null, campaign: null };
}
