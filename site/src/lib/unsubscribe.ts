/**
 * Turns off waitlist emails for one sign-up. The unsubscribe link in each email carries
 * the sign-up's Airtable record ID; the page posts it to PUBLIC_UNSUBSCRIBE_ENDPOINT
 * (the n8n workflow "Revive Healthcare: email unsubscribe").
 */
import { PUBLIC_UNSUBSCRIBE_ENDPOINT } from 'astro:env/client';

/** Airtable record IDs: "rec" followed by 14 letters or digits. */
export const RECORD_ID_PATTERN = /^rec[A-Za-z0-9]{14}$/;

const TIMEOUT_MS = 15_000;

export async function requestUnsubscribe(id: string): Promise<void> {
  if (!PUBLIC_UNSUBSCRIBE_ENDPOINT) {
    if (import.meta.env.DEV) {
      // Local development without a backend: pretend it worked so the page can be tested.
      console.info('[unsubscribe] PUBLIC_UNSUBSCRIBE_ENDPOINT is not set; simulating success.', id);
      await new Promise((resolve) => setTimeout(resolve, 600));
      return;
    }
    throw new Error('PUBLIC_UNSUBSCRIBE_ENDPOINT is not set.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(PUBLIC_UNSUBSCRIBE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ id }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw new Error(`Unsubscribe endpoint responded with ${response.status}.`);
  }
}
