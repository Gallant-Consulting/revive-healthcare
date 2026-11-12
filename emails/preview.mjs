// Renders the waitlist emails with sample data into emails/preview/, and writes the code
// for the n8n "Build emails" node to emails/dist/build-emails.n8n.js.
//
//   node emails/preview.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEmails } from './templates.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const previewDir = join(here, 'preview');
const distDir = join(here, 'dist');
mkdirSync(previewDir, { recursive: true });
mkdirSync(distDir, { recursive: true });

const base = {
  firstName: 'Maria',
  lastName: 'Lopez',
  email: 'maria.lopez-hernandez.billing@lakeshoremanufacturing.example.com',
  phone: '+12165550123',
  zip: '44113',
  referral: 'A friend at work',
  utm: { source: 'flyer', medium: 'print', campaign: 'launch' },
  submittedAt: '2026-11-11T19:42:00.000Z',
  airtableUrl: 'https://airtable.com/appEFfIteG4mCetMv/tbldCPPr1PjAHVkwv/recEXAMPLE',
  unsubscribeUrl: 'https://www.rhcproviders.com/unsubscribe?id=recEXAMPLE',
};
const samples = {
  individual: { ...base, plan: 'Individual' },
  employer: { ...base, plan: 'Employer', company: 'Lakeshore Manufacturing', employeeCount: '51-200' },
  // Hostile input: names and companies must come out as text, never as markup.
  escaping: {
    ...base,
    plan: 'Employer',
    firstName: '<b>Eve</b>',
    lastName: '"><script>alert(1)</script>',
    company: 'Acme & Sons <a href="https://evil.example">click</a>',
    employeeCount: '1-10',
    referral: '<img src=x onerror=alert(1)>',
    utm: { source: '', medium: '', campaign: '' },
  },
};

const files = [];
for (const [name, data] of Object.entries(samples)) {
  const emails = buildEmails(data);
  const pick = name === 'individual' ? ['individual', 'team'] : name === 'employer' ? ['employer', 'team'] : ['employer', 'team'];
  for (const kind of pick) {
    const file = `${name}-${kind}.html`;
    writeFileSync(join(previewDir, file), emails[kind].html);
    writeFileSync(join(previewDir, `${name}-${kind}.txt`), `Subject: ${emails[kind].subject}\n\n${emails[kind].text}\n`);
    files.push(file);
  }
}

// Index page linking the previews.
writeFileSync(
  join(previewDir, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>Email previews</title><body style="font-family:system-ui;padding:24px">` +
    `<h1>Waitlist email previews</h1><ul>${files.map((f) => `<li><a href="${f}">${f}</a> · <a href="${f.replace('.html', '.txt')}">text</a></li>`).join('')}</ul>`,
);

// Code for the n8n Code node: the templates without `export`, plus the glue that reads the sign-up.
const source = readFileSync(join(here, 'templates.mjs'), 'utf8').replace(/^export function /m, 'function ');
const glue = `
// ---- n8n glue: reads the sign-up from "Check sign-up" and the Airtable record from the input ----
const signup = $('Check sign-up').item.json.fields;
return {
  json: buildEmails({
    plan: signup.Plan,
    firstName: signup['First name'],
    lastName: signup['Last name'],
    email: signup.Email,
    phone: signup.Phone,
    zip: signup.ZIP,
    company: signup.Company ?? '',
    employeeCount: signup['Employee count'] ?? '',
    referral: signup.Referral ?? '',
    utm: { source: signup['UTM source'] ?? '', medium: signup['UTM medium'] ?? '', campaign: signup['UTM campaign'] ?? '' },
    submittedAt: signup['Submitted at'],
    airtableUrl: 'https://airtable.com/appEFfIteG4mCetMv/tbldCPPr1PjAHVkwv/' + $json.id,
    unsubscribeUrl: SITE_URL + '/unsubscribe?id=' + $json.id,
  }),
};
`;
writeFileSync(join(distDir, 'build-emails.n8n.js'), source + glue);

console.log(`Wrote ${files.length} previews to emails/preview/ and emails/dist/build-emails.n8n.js`);
