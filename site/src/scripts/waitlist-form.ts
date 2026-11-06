import { submitWaitlist, type EmployeeCount, type Plan, type WaitlistPayload } from '../lib/submit-waitlist';
import { checkPhone, emailError, suggestEmail } from '../lib/validate';

type Control = HTMLInputElement | HTMLSelectElement;

const PLAN_LABELS: Record<Plan, string> = {
  individual: 'Individual membership',
  employer: 'Employer package',
};

// Fields in the order they appear, so the first invalid one gets focus.
const FIELD_ORDER = ['firstName', 'lastName', 'email', 'phone', 'zip', 'company', 'employeeCount', 'consent'];
const EMPLOYER_FIELDS = new Set(['company', 'employeeCount']);

const VALIDATORS: Record<string, (control: Control) => string | null> = {
  firstName: (c) => (c.value.trim() ? null : 'Enter your first name.'),
  lastName: (c) => (c.value.trim() ? null : 'Enter your last name.'),
  email: (c) => emailError(c.value),
  phone: (c) => checkPhone(c.value).error ?? null,
  zip: (c) => {
    const value = c.value.trim();
    if (!value) return 'Enter your ZIP code.';
    return /^\d{5}$/.test(value) ? null : 'Enter a 5-digit ZIP code.';
  },
  company: (c) => (c.value.trim() ? null : 'Enter your company name.'),
  employeeCount: (c) => (c.value ? null : 'Choose the number of employees.'),
  consent: (c) =>
    (c as HTMLInputElement).checked ? null : 'Please agree to be contacted so we can reach you about membership.',
};

function readUtm(): WaitlistPayload['utm'] {
  const params = new URLSearchParams(window.location.search);
  const read = (key: string) => params.get(key)?.trim().slice(0, 200) || null;
  return { source: read('utm_source'), medium: read('utm_medium'), campaign: read('utm_campaign') };
}

export function initWaitlistForm(root: HTMLElement) {
  const form = root.querySelector<HTMLFormElement>('[data-waitlist-form]');
  if (!form) return;

  const planButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-plan]')];
  const planLabel = root.querySelector<HTMLElement>('[data-plan-label]')!;
  const employerFields = root.querySelector<HTMLElement>('[data-employer-fields]')!;
  const submitButton = form.querySelector<HTMLButtonElement>('[data-submit]')!;
  const submitError = form.querySelector<HTMLElement>('[data-submit-error]')!;
  const honeypot = form.querySelector<HTMLInputElement>('[data-honeypot]')!;
  const formView = root.querySelector<HTMLElement>('[data-form-view]')!;
  const successView = root.querySelector<HTMLElement>('[data-success-view]')!;
  const successHeading = root.querySelector<HTMLElement>('[data-success-heading]')!;
  const addAnotherButton = root.querySelector<HTMLButtonElement>('[data-add-another]')!;
  const emailSuggestion = root.querySelector<HTMLElement>('[data-email-suggestion]')!;

  // The script handles validation; without it, the browser's built-in checks still apply.
  form.noValidate = true;

  const submitLabel = submitButton.textContent?.trim() || 'Join the waitlist';
  const utm = readUtm();
  const edited = new Set<string>();
  let plan: Plan = 'individual';
  let sending = false;

  const control = (name: string) => form.elements.namedItem(name) as Control | null;
  const value = (name: string) => control(name)?.value.trim() ?? '';

  const activeFields = () =>
    FIELD_ORDER.filter((name) => plan === 'employer' || !EMPLOYER_FIELDS.has(name))
      .map(control)
      .filter((c): c is Control => c !== null);

  function errorElement(c: Control) {
    return document.getElementById(`${c.id}-error`);
  }

  function setError(c: Control, message: string | null) {
    const el = errorElement(c);
    const text = el?.querySelector('[data-error-text]');
    if (message) {
      c.setAttribute('aria-invalid', 'true');
      if (text) text.textContent = message;
      if (el) el.hidden = false;
    } else {
      c.removeAttribute('aria-invalid');
      if (text) text.textContent = '';
      if (el) el.hidden = true;
    }
  }

  function validate(c: Control): boolean {
    const message = VALIDATORS[c.name]?.(c) ?? null;
    setError(c, message);
    return message === null;
  }

  /** Offers a one-tap fix for a likely typo in a common email domain. Never blocks submitting. */
  function updateEmailSuggestion() {
    const email = control('email');
    const suggestion = email && !email.hasAttribute('aria-invalid') ? suggestEmail(email.value) : null;
    if (!email || !suggestion) {
      emailSuggestion.replaceChildren();
      return;
    }
    const fix = document.createElement('button');
    fix.type = 'button';
    fix.className = 'field__suggestion-fix';
    fix.textContent = suggestion;
    fix.addEventListener('click', () => {
      email.value = suggestion;
      emailSuggestion.replaceChildren();
      validate(email);
      email.focus();
    });
    emailSuggestion.replaceChildren('Did you mean ', fix, '?');
  }

  function setPlan(next: Plan) {
    plan = next;
    for (const button of planButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.plan === next));
    }
    planLabel.textContent = PLAN_LABELS[next];
    employerFields.hidden = next !== 'employer';
    if (next !== 'employer') {
      for (const name of EMPLOYER_FIELDS) {
        const c = control(name);
        if (c) setError(c, null);
      }
    }
  }

  function setSending(isSending: boolean) {
    sending = isSending;
    submitButton.disabled = isSending;
    submitButton.textContent = isSending ? 'Sending…' : submitLabel;
    form!.toggleAttribute('aria-busy', isSending);
  }

  function clearSubmitError() {
    submitError.replaceChildren();
  }

  function showSubmitError() {
    // TODO(GAL-303): copy and styling are provisional until the failure state is designed.
    const message = document.createElement('p');
    message.textContent =
      "We couldn't save your place. Please check your connection and try again. Everything you entered is still here.";
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn btn-outline';
    retry.textContent = 'Try again';
    retry.addEventListener('click', () => form!.requestSubmit());
    submitError.replaceChildren(message, retry);
    retry.focus();
  }

  function showSuccess() {
    formView.hidden = true;
    successView.hidden = false;
    successHeading.focus();
  }

  /** Clears the form so another person can sign up. The selected plan stays. */
  function startAnotherSignup() {
    form!.reset();
    edited.clear();
    for (const c of activeFields()) setError(c, null);
    clearSubmitError();
    emailSuggestion.replaceChildren();
    setPlan(plan);
    successView.hidden = true;
    formView.hidden = false;
    control('firstName')?.focus();
  }

  function buildPayload(): WaitlistPayload {
    const payload: WaitlistPayload = {
      plan,
      firstName: value('firstName'),
      lastName: value('lastName'),
      email: value('email'),
      phone: checkPhone(value('phone')).e164!,
      zip: value('zip'),
      consent: true,
      utm,
      submittedAt: new Date().toISOString(),
    };
    if (plan === 'employer') {
      payload.company = value('company');
      payload.employeeCount = value('employeeCount') as EmployeeCount;
    }
    const referral = value('referral');
    if (referral) payload.referral = referral;
    return payload;
  }

  for (const button of planButtons) {
    button.addEventListener('click', () => setPlan(button.dataset.plan as Plan));
  }

  // Validate on blur, once the person has typed in the field (tabbing past an
  // empty field doesn't flag it; submitting does).
  form.addEventListener('input', (event) => {
    const c = event.target as Control;
    if (!VALIDATORS[c.name]) return;
    edited.add(c.name);
    if (c.name === 'email') emailSuggestion.replaceChildren();
    // Clear the message as soon as the field is fixed.
    if (c.getAttribute('aria-invalid') === 'true') validate(c);
  });

  form.addEventListener('focusout', (event) => {
    const c = event.target as Control;
    if (!VALIDATORS[c.name]) return;
    if (edited.has(c.name) || c.getAttribute('aria-invalid') === 'true') validate(c);
    if (c.name === 'email') updateEmailSuggestion();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending) return;
    clearSubmitError();

    let firstInvalid: Control | null = null;
    for (const c of activeFields()) {
      if (!validate(c) && !firstInvalid) firstInvalid = c;
    }
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    // Bots fill in the hidden field. Look successful, send nothing.
    if (honeypot.value) {
      showSuccess();
      return;
    }

    setSending(true);
    try {
      await submitWaitlist(buildPayload());
      setSending(false);
      showSuccess();
    } catch (error) {
      console.error(error);
      setSending(false);
      showSubmitError();
    }
  });

  addAnotherButton.addEventListener('click', startAnotherSignup);
}
