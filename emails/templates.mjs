/**
 * Waitlist emails: the team notice and the two confirmations (Individual, Employer).
 *
 * Deployed as the "Build emails" Code node in the n8n workflow
 * "Revive Healthcare: waitlist sign-ups". Run `node emails/preview.mjs` to render
 * previews and regenerate the code for that node (see emails/README.md).
 *
 * Everything below `export` must stay plain JavaScript with no imports: the
 * preview script pastes it into the n8n Code node as-is.
 */

const SITE_URL = 'https://www.rhcproviders.com';

// Design tokens from site/src/styles/tokens.css.
const c = {
  ink: '#1B1F23',
  inkMuted: '#3E454C',
  inkSubtle: '#5A6168',
  cream: '#F7F6F2',
  stone: '#ECE8DE',
  white: '#FFFFFF',
  rule: '#E6E3DA',
  tealDeep: '#0F5E5A',
  tealMid: '#2F7A73',
};
// Newsreader and Inter Tight when the mail client has them; Georgia and Helvetica otherwise.
const serif = "Newsreader, Georgia, 'Times New Roman', serif";
const sans = "'Inter Tight', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const EMPLOYEE_COUNTS = { '1-10': '1–10', '11-50': '11–50', '51-200': '51–200', '200+': '200+' };

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

/** Collapses whitespace and line breaks, for subject lines and one-line text. */
function oneLine(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function formatPhone(e164) {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164 ?? '');
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : oneLine(e164);
}

function formatSubmitted(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

// ---- Building blocks (inline styles; tables for layout so Outlook and Gmail agree) ----

const eyebrow = (text) =>
  `<p style="margin:0 0 12px;font-family:${sans};font-size:13px;line-height:1.4;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${c.inkSubtle};">${text}</p>`;

const heading = (text) =>
  `<h1 class="heading" style="margin:0 0 20px;font-family:${serif};font-size:32px;line-height:1.1;font-weight:400;color:${c.ink};">${text}</h1>`;

const paragraph = (html, last = false) =>
  `<p style="margin:0 0 ${last ? 0 : 16}px;font-family:${sans};font-size:16px;line-height:1.6;color:${c.inkMuted};">${html}</p>`;

const spacer = (px) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:${px}px;line-height:${px}px;font-size:0;">&nbsp;</td></tr></table>`;

const button = (href, label) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:12px;background:${c.tealDeep};">` +
  `<a href="${esc(href)}" style="display:inline-block;padding:14px 22px;font-family:${sans};font-size:16px;line-height:1.2;font-weight:600;color:${c.white};text-decoration:none;border-radius:12px;">${label}</a>` +
  `</td></tr></table>`;

/** The site's text-message card: stone panel, a small label and a teal care-team bubble. */
const messageCard = (label, message) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${c.stone};border-radius:20px;padding:22px;">` +
  `<p style="margin:0 0 12px;font-family:${sans};font-size:12px;line-height:1.4;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${c.inkSubtle};">${label}</p>` +
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:86%;"><tr><td style="background:${c.tealMid};border-radius:18px 18px 18px 6px;padding:12px 16px;font-family:${sans};font-size:16px;line-height:1.5;color:${c.white};">${message}</td></tr></table>` +
  `</td></tr></table>`;

/** A cream card like the site's benefit cards: serif title, muted body. */
const creamCard = (title, body) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${c.cream};border-radius:16px;padding:22px 24px;">` +
  `<p style="margin:0 0 6px;font-family:${serif};font-size:22px;line-height:1.2;color:${c.ink};">${title}</p>` +
  `<p style="margin:0;font-family:${sans};font-size:16px;line-height:1.5;color:${c.inkMuted};">${body}</p>` +
  `</td></tr></table>`;

const detailRows = (rows) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${c.rule};">` +
  rows
    .map(
      ([label, value]) =>
        `<tr>` +
        `<td class="label" valign="top" style="width:132px;padding:14px 12px 10px 0;border-bottom:1px solid ${c.rule};font-family:${sans};font-size:13px;line-height:1.5;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${c.inkSubtle};">${label}</td>` +
        `<td valign="top" style="padding:12px 0;border-bottom:1px solid ${c.rule};font-family:${sans};font-size:16px;line-height:1.5;color:${c.ink};overflow-wrap:anywhere;word-break:break-word;">${value}</td>` +
        `</tr>`,
    )
    .join('') +
  `</table>`;

const link = (href, label) => `<a href="${esc(href)}" style="color:${c.tealDeep};text-decoration:underline;">${label}</a>`;

function layout({ title, preheader, content, footer }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${title}</title>
<style>
  @media (max-width: 620px) {
    .outer { padding: 24px 12px !important; }
    .card { padding: 28px 22px !important; }
    .heading { font-size: 28px !important; }
    .label { width: 92px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${c.cream};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}${'&nbsp;&zwnj;'.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${c.cream};">
<tr><td class="outer" align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
<tr><td style="padding:0 6px 22px;font-family:${serif};font-size:26px;line-height:1.2;color:${c.ink};">
<a href="${SITE_URL}" style="color:${c.ink};text-decoration:none;">Revive Healthcare Providers</a>
</td></tr>
<tr><td class="card" style="background:${c.white};border-radius:20px;padding:40px;overflow-wrap:anywhere;word-break:break-word;">
${content}
</td></tr>
<tr><td style="padding:28px 6px 0;font-family:${sans};font-size:13px;line-height:1.55;color:${c.inkSubtle};">
${footer}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

const patientFooter =
  `<p style="margin:0 0 4px;font-family:${serif};font-size:18px;line-height:1.4;color:${c.ink};">Revive Healthcare Providers</p>` +
  `<p style="margin:0 0 14px;">Cleveland, Ohio</p>` +
  `<p style="margin:0 0 10px;">If you are experiencing a medical emergency, call 911. Please don't send medical information by email.</p>` +
  `<p style="margin:0;">You're receiving this because you joined the waitlist at ${link(SITE_URL, 'rhcproviders.com')}. ${link(`${SITE_URL}/privacy`, 'Privacy Policy')}</p>`;

const patientFooterText =
  'Revive Healthcare Providers\nCleveland, Ohio\n\n' +
  "If you are experiencing a medical emergency, call 911. Please don't send medical information by email.\n\n" +
  `You're receiving this because you joined the waitlist at rhcproviders.com. Privacy Policy: ${SITE_URL}/privacy`;

// ---- The three emails ----

/**
 * @param {object} d  One sign-up, as saved: plan ('Individual' | 'Employer'), firstName, lastName,
 *   email, phone (E.164), zip, company, employeeCount, referral, utm {source, medium, campaign},
 *   submittedAt (ISO 8601), airtableUrl.
 * @returns {{ individual, employer, team }} each with { subject, html, text }.
 */
export function buildEmails(d) {
  const first = oneLine(d.firstName);
  const fullName = oneLine(`${d.firstName ?? ''} ${d.lastName ?? ''}`);
  const company = oneLine(d.company);
  const employees = EMPLOYEE_COUNTS[d.employeeCount] ?? oneLine(d.employeeCount);
  const isEmployer = d.plan === 'Employer';
  const phone = formatPhone(d.phone);
  const submitted = formatSubmitted(d.submittedAt);
  const campaign = [d.utm?.source, d.utm?.medium, d.utm?.campaign].map(oneLine).filter(Boolean).join(' / ');

  // Individual confirmation
  const individualNext = "Our office will reach out personally before enrollment opens. There's nothing else you need to do for now.";
  const individual = {
    subject: 'Your place on the Revive Healthcare Providers waitlist is saved',
    html: layout({
      title: 'Your place is saved.',
      preheader: esc(individualNext),
      content:
        eyebrow('Individual membership') +
        heading('Your place is saved.') +
        paragraph(`Hi ${esc(first)},`) +
        paragraph('Thanks for joining the Revive Healthcare Providers waitlist for an individual membership.') +
        paragraph(
          'We are a Direct Primary Care practice. One flat monthly membership covers same-day or next-day visits, unhurried appointments, and a care team you can reach by call, text, or email.',
        ) +
        paragraph('We keep our patient panel small so your doctor always has time for you.', true) +
        spacer(24) +
        messageCard('What happens next', esc(individualNext)) +
        spacer(28) +
        button(SITE_URL, 'Learn more about Revive'),
      footer: patientFooter,
    }),
    text:
      `Hi ${first},\n\n` +
      'Thanks for joining the Revive Healthcare Providers waitlist for an individual membership. Your place is saved.\n\n' +
      'We are a Direct Primary Care practice. One flat monthly membership covers same-day or next-day visits, unhurried appointments, and a care team you can reach by call, text, or email.\n\n' +
      'We keep our patient panel small so your doctor always has time for you.\n\n' +
      `What happens next: ${individualNext}\n\n` +
      `Learn more: ${SITE_URL}\n\n` +
      patientFooterText,
  };

  // Employer confirmation
  const employerNext =
    "Our office will reach out personally to learn about your team and talk through options before enrollment opens. There's nothing else you need to do for now.";
  const employer = {
    subject: 'Thanks for your interest in Revive Healthcare Providers for your team',
    html: layout({
      title: 'Thanks for your interest.',
      preheader: esc(employerNext),
      content:
        eyebrow('Employer package') +
        heading('Thanks for your interest.') +
        paragraph(`Hi ${esc(first)},`) +
        paragraph(
          `Thanks for your interest in a Revive Healthcare Providers employer package for ${esc(company)}. We've added you to our waitlist.`,
        ) +
        paragraph(
          'Our corporate and employer packages are tiered health programs designed to support employee wellness and reduce downtime. Pricing is tailored to the size and needs of your team.',
          true,
        ) +
        spacer(24) +
        creamCard(esc(company), employees ? `${esc(employees)} employees` : 'Employer package') +
        spacer(28) +
        eyebrow('What happens next') +
        paragraph(esc(employerNext), true) +
        spacer(28) +
        button(SITE_URL, 'Learn more about Revive'),
      footer: patientFooter,
    }),
    text:
      `Hi ${first},\n\n` +
      `Thanks for your interest in a Revive Healthcare Providers employer package for ${company}. We've added you to our waitlist.\n\n` +
      'Our corporate and employer packages are tiered health programs designed to support employee wellness and reduce downtime. Pricing is tailored to the size and needs of your team.\n\n' +
      `Your team: ${company}${employees ? `, ${employees} employees` : ''}\n\n` +
      `What happens next: ${employerNext}\n\n` +
      `Learn more: ${SITE_URL}\n\n` +
      patientFooterText,
  };

  // Team notice
  const planLine = isEmployer ? `Employer package${company ? ` · ${company}` : ''}` : 'Individual membership';
  const details = [
    ['Email', esc(d.email) ? link(`mailto:${d.email}`, esc(d.email)) : ''],
    ['Phone', phone ? link(`tel:${d.phone}`, esc(phone)) : ''],
    ['ZIP', esc(d.zip)],
    ['Company', isEmployer ? esc(company) : ''],
    ['Employees', isEmployer ? esc(employees) : ''],
    ['Heard about us', esc(oneLine(d.referral))],
    ['Campaign', esc(campaign)],
    ['Submitted', esc(submitted)],
  ].filter(([, value]) => value);
  const detailsText = [
    ['Plan', planLine],
    ['Name', fullName],
    ['Email', oneLine(d.email)],
    ['Phone', phone],
    ['ZIP', oneLine(d.zip)],
    ['Company', isEmployer ? company : ''],
    ['Employees', isEmployer ? employees : ''],
    ['Heard about us', oneLine(d.referral)],
    ['Campaign', campaign],
    ['Submitted', submitted],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n');

  const team = {
    subject: `New waitlist sign-up: ${fullName} (${isEmployer ? `Employer: ${company}` : 'Individual'})`,
    html: layout({
      title: 'New waitlist sign-up',
      preheader: esc(`${planLine} · ${oneLine(d.email)} · ${phone}`),
      content:
        eyebrow('New waitlist sign-up') +
        `<h1 class="heading" style="margin:0 0 6px;font-family:${serif};font-size:32px;line-height:1.1;font-weight:400;color:${c.ink};">${esc(fullName)}</h1>` +
        `<p style="margin:0 0 24px;font-family:${sans};font-size:16px;line-height:1.5;font-weight:600;color:${c.tealMid};">${esc(planLine)}</p>` +
        detailRows(details) +
        spacer(28) +
        (d.airtableUrl ? button(d.airtableUrl, 'Open in Airtable') + spacer(20) : '') +
        paragraph(`Reply to this email to respond to ${esc(first)} directly.`, true),
      footer: `<p style="margin:0;">Sent automatically by the waitlist form at ${link(SITE_URL, 'rhcproviders.com')}.</p>`,
    }),
    text:
      `New waitlist sign-up\n\n${detailsText}\n\n` +
      (d.airtableUrl ? `Airtable record: ${d.airtableUrl}\n\n` : '') +
      `Reply to this email to respond to ${first} directly.`,
  };

  return { individual, employer, team };
}
