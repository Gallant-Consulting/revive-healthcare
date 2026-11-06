/**
 * Sends a waitlist sign-up to the form backend.
 *
 * This is the only file that knows about the backend. To switch providers
 * (Supabase edge function, Formspree, etc.), change PUBLIC_FORM_ENDPOINT and,
 * if the provider needs it, the headers or body shape below. Resolve on
 * success; throw on anything else so the form can show its retry message.
 */
import { PUBLIC_FORM_ENDPOINT } from 'astro:env/client';

export type Plan = 'individual' | 'employer';
export type EmployeeCount = '1-10' | '11-50' | '51-200' | '200+';

export interface WaitlistPayload {
  plan: Plan;
  firstName: string;
  lastName: string;
  email: string;
  /** E.164, e.g. "+12165550123". */
  phone: string;
  zip: string;
  company?: string;
  employeeCount?: EmployeeCount;
  referral?: string;
  consent: true;
  utm: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
  };
  /** ISO 8601 timestamp from the visitor's browser. */
  submittedAt: string;
}

export class SubmitError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SubmitError';
  }
}

const TIMEOUT_MS = 15_000;

export async function submitWaitlist(payload: WaitlistPayload): Promise<void> {
  if (!PUBLIC_FORM_ENDPOINT) {
    if (import.meta.env.DEV) {
      // Local development without a backend: pretend it worked so the UI can be tested.
      console.info('[waitlist] PUBLIC_FORM_ENDPOINT is not set; simulating success.', payload);
      await new Promise((resolve) => setTimeout(resolve, 800));
      return;
    }
    throw new SubmitError('PUBLIC_FORM_ENDPOINT is not set.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(PUBLIC_FORM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    throw new SubmitError('Network error while submitting the waitlist form.', { cause: error });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new SubmitError(`Waitlist endpoint responded with ${response.status}.`);
  }
}
