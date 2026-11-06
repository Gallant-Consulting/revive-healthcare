/**
 * Browser-side checks for the waitlist form's email and phone fields.
 * Pure functions, no DOM, so they can be tested on their own.
 */

// --- Email -----------------------------------------------------------------

// Unquoted local part (RFC 5322 "dot-atom"): no leading, trailing or doubled dots.
const LOCAL_PART = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
// A domain label: letters or digits, with hyphens allowed only inside.
const DOMAIN_LABEL = /^[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?$/u;
// Top-level domain: letters only (".c0m" is a typo), or a punycode TLD.
const TOP_LEVEL = /^(?:\p{L}{2,63}|xn--[a-z0-9-]{1,59})$/iu;

const EMAIL_FORMAT = 'Enter an email address like name@example.com.';

/** Returns an error message, or null if the address looks valid. */
export function emailError(raw: string): string | null {
  const value = raw.trim();
  if (!value) return 'Enter your email address.';
  if (/\s/.test(value)) return "Email addresses can't contain spaces.";

  const at = value.indexOf('@');
  if (at < 1 || at !== value.lastIndexOf('@')) return EMAIL_FORMAT;

  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const labels = domain.split('.');
  const valid =
    value.length <= 254 &&
    local.length <= 64 &&
    LOCAL_PART.test(local) &&
    domain.length <= 253 &&
    labels.length >= 2 &&
    labels.every((label) => DOMAIN_LABEL.test(label)) &&
    TOP_LEVEL.test(labels[labels.length - 1]);
  return valid ? null : EMAIL_FORMAT;
}

// Most common first: ties go to the earlier entry.
const COMMON_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'comcast.net',
  'att.net',
  'sbcglobal.net',
  'live.com',
  'msn.com',
  'verizon.net',
  'charter.net',
  'ymail.com',
  'me.com',
  'mac.com',
  'mail.com',
  'protonmail.com',
  'proton.me',
];

// Mistyped endings for any domain. (".co" and ".cm" are real TLDs, so they're not here.)
const TOP_LEVEL_TYPOS: Record<string, string> = {
  con: 'com',
  cmo: 'com',
  ocm: 'com',
  comm: 'com',
  vom: 'com',
  xom: 'com',
  cpm: 'com',
  nte: 'net',
  nett: 'net',
  ogr: 'org',
  rog: 'org',
};

/** Edit distance counting a swap of two neighboring letters as one edit. */
function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/**
 * For a valid address with a likely typo in a common domain, returns the corrected
 * address ("name@gmial.com" → "name@gmail.com"). Otherwise null.
 */
export function suggestEmail(raw: string): string | null {
  const value = raw.trim();
  if (emailError(value)) return null;
  const at = value.indexOf('@');
  const local = value.slice(0, at);
  const domain = value.slice(at + 1).toLowerCase();
  if (COMMON_DOMAINS.includes(domain)) return null;

  let best: string | null = null;
  let bestDistance = Infinity;
  for (const candidate of COMMON_DOMAINS) {
    const distance = editDistance(domain, candidate);
    // Short domains get one edit of leeway, not two, to limit false matches.
    const limit = candidate.length <= 8 ? 1 : 2;
    if (distance <= limit && distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  if (best) return `${local}@${best}`;

  const labels = domain.split('.');
  const fix = TOP_LEVEL_TYPOS[labels[labels.length - 1]];
  if (fix) return `${local}@${[...labels.slice(0, -1), fix].join('.')}`;
  return null;
}

// --- Phone -----------------------------------------------------------------

export type PhoneResult = { e164: string; error?: undefined } | { e164?: undefined; error: string };

const PHONE_FORMAT = 'Enter a 10-digit US phone number, like 216-555-0123.';

/** A North American area code or exchange: starts 2–9, and isn't a service code like 911. */
function isValidCode(code: string): boolean {
  return /^[2-9]\d\d$/.test(code) && !(code[1] === '1' && code[2] === '1');
}

/**
 * Checks a US phone number in any common format ("(216) 555-0123", "216.555.0123",
 * "+1 216 555 0123") and returns it as E.164, or an error message.
 */
export function checkPhone(raw: string): PhoneResult {
  const value = raw.trim();
  if (!value) return { error: 'Enter your mobile phone number.' };
  if (!/^\+?[\d\s().-]+$/.test(value)) {
    return { error: 'Use only numbers, spaces, dashes, dots or parentheses.' };
  }
  if (value.startsWith('+') && !value.replace(/[\s().-]/g, '').startsWith('+1')) {
    return { error: 'Enter a US phone number, like 216-555-0123.' };
  }

  let digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length !== 10) return { error: PHONE_FORMAT };

  const area = digits.slice(0, 3);
  const exchange = digits.slice(3, 6);
  // N9X area codes are reserved and none are in use.
  if (!isValidCode(area) || area[1] === '9') {
    return { error: "That area code isn't valid. Check the number and try again." };
  }
  if (!isValidCode(exchange)) {
    return { error: "That isn't a valid US phone number. Check the number and try again." };
  }
  return { e164: `+1${digits}` };
}
