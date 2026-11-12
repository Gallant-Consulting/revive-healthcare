# Revive Healthcare: waitlist site

A one-page marketing and waitlist site for Revive Healthcare Providers, a Direct Primary Care practice in Cleveland, Ohio. Built with [Astro](https://astro.build) (static output) and plain CSS. The only dependency is Astro.

The approved design (Direction E) is in `../design-reference/`. That folder isn't in the repo; `design-reference.zip` has the same files (build ticket GAL-309). This build follows those files; see [Design notes](#design-notes) for every place it differs and why.

## Setup

Requires **Node 22.22 or later** (`.nvmrc` pins Node 22 for hosts that read it).

```bash
cd site
npm install
cp .env.example .env   # then fill in the values below
npm run dev            # http://localhost:4321
```

Astro is pinned to `7.4.1`. Astro 7.4.2 and later need Node 22.23.4+, so upgrade Node before upgrading Astro.

## Environment variables

All of these are read **at build time** and baked into the static files, so a change needs a rebuild and redeploy.

| Variable | Required | What it does |
|---|---|---|
| `PUBLIC_FORM_ENDPOINT` | For production | URL the waitlist form POSTs JSON to. If unset, `npm run dev` simulates a successful submission and a production build shows the form's error message. Must be a full URL. |
| `PUBLIC_UNSUBSCRIBE_ENDPOINT` | For production | URL the `/unsubscribe` page POSTs `{ id }` to: the n8n workflow "Revive Healthcare: email unsubscribe", at `https://n8n.workgallantly.com/webhook/revive-unsubscribe`. If unset, the page shows an error and points people to office@rhcproviders.com. |
| `PUBLIC_ANALYTICS_SRC` | No | URL of a **cookieless** analytics script (e.g. Plausible, Fathom). Adds one `<script defer>` tag when set; adds nothing when empty. Never put ad or social tracking pixels here. |
| `SITE_URL` | No | The site's absolute URL. Defaults to `https://www.rhcproviders.com`. Used for the canonical link and the absolute `og:image` URL that link previews need. Set it in the host's build settings or the shell to override (it isn't read from `.env`). |

## Build and preview

```bash
npm run build     # outputs static files to dist/
npm run preview   # serves dist/ at http://localhost:4321
```

## Deploy

Any static host works. Use these settings:

- **Base directory:** `site`
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Node version:** 22 (from `.nvmrc`)
- **Environment variables:** as above

Pages are built as `/privacy/index.html` and `/terms/index.html`, so `/privacy` and `/terms` work on every common host (Netlify, Cloudflare Pages, Vercel, S3 + CloudFront, GitHub Pages).

For a staging URL, put it behind the host's password protection or send an `X-Robots-Tag: noindex` header, so it doesn't get indexed.

## The waitlist form

### Behavior

- **Validation:** fields are checked on blur once the person has typed in them, and all fields are checked on submit. Messages appear under each field and are tied to it with `aria-describedby`. After a failed submit, focus moves to the first invalid field.
- **Email:**
  - **Format:** one `@` and no spaces. The part before the `@` can't start or end with a dot or have two dots in a row. Each part of the domain is letters, digits and inner hyphens, and the ending is letters only, so `.c0m` fails.
  - **Typo suggestions:** a likely typo in a common domain gets a "Did you mean name@gmail.com?" line with a one-tap fix. The same goes for an ending like `.con`. It's only a suggestion: the address as typed can still be submitted.
- **Phone:**
  - **Format:** US numbers only, in any common format. Letters and extensions are rejected.
  - **Number rules:** the area code and the next three digits can't start with 0 or 1, can't be a service code like 911, and the area code can't have 9 as its middle digit (those codes are reserved).
  - **Sent as:** E.164, e.g. `+12165550123`. Numbers in the fictional 555-01XX range pass, so they can be used for testing.
- **Where the checks live:** in `src/lib/validate.ts`, as plain functions with no page code, so they can be tested on their own.
- **Employer fields:** Company name and Number of employees appear and are required only when the Employer card is selected.
- **While sending:** the submit button is disabled and reads "Sending…".
- **Network or server error:** a message with a **Try again** button appears above the submit button. Everything the person entered is kept.
- **Success:** the form is replaced with "Your place is saved.", and focus moves to that heading. **Add another person** clears the form for another sign-up, keeping the selected plan, and moves focus to First name.
- **Honeypot:** a hidden `website` field. If it's filled in, the success message is shown and nothing is sent.
- **Without JavaScript:** a message asks the person to turn it on. The form uses `method="post"`, so entries never end up in a URL.

The form never collects date of birth, gender, address or medical free text.

### Payload

`POST` to `PUBLIC_FORM_ENDPOINT` with `Content-Type: application/json`:

```json
{
  "plan": "employer",
  "firstName": "Test",
  "lastName": "User",
  "email": "test.user@example.com",
  "phone": "+12165550123",
  "zip": "44113",
  "company": "Test Co",
  "employeeCount": "51-200",
  "referral": "Flyer",
  "consent": true,
  "utm": { "source": "flyer", "medium": "print", "campaign": "launch" },
  "submittedAt": "2026-11-05T19:11:27.430Z"
}
```

- `phone` is normalized to E.164 (US numbers only).
- `company` and `employeeCount` are sent only for `"plan": "employer"`.
- `employeeCount` is one of `1-10`, `11-50`, `51-200`, `200+`.
- `referral` is sent only if filled in.
- `utm` values come from `utm_source`, `utm_medium` and `utm_campaign` in the page URL, or are `null`. They're remembered for the rest of the visit (session storage, per browser tab), so someone who lands on any page from a campaign link and signs up later in the visit still carries them. A new campaign link replaces them. See `src/lib/utm.ts`.

Any 2xx response counts as success. Anything else, a network error, or no response within 15 seconds shows the retry message.

### Swapping the backend

All backend code is in `src/lib/submit-waitlist.ts`. The endpoint must accept a cross-origin JSON POST (CORS) from the site's domain. Here's what each option needs:

- **Formspree:** set the endpoint to `https://formspree.io/f/<form-id>`. The module already sends `Accept: application/json`, which Formspree needs in order to reply with JSON.
- **Supabase edge function:** edge functions require an `Authorization: Bearer <anon key>` header unless deployed with `--no-verify-jwt`. Add the header in `submit-waitlist.ts` if needed. The function should validate the payload and insert it into a table.

### Testing it locally

- **Success:** with `PUBLIC_FORM_ENDPOINT` empty, `npm run dev` logs the payload to the browser console and shows the success state.
- **Failure:** set `PUBLIC_FORM_ENDPOINT=http://localhost:4321/nope` (the dev server returns 404), restart `npm run dev`, and submit.

## Unsubscribing

Each confirmation email ends with an **Unsubscribe** link to `/unsubscribe?id=<Airtable record ID>`. That page asks the person to press **Unsubscribe** before anything changes, because email security scanners open every link in an email automatically. The button POSTs the record ID to `PUBLIC_UNSUBSCRIBE_ENDPOINT`, and the n8n workflow sets **Email opt-in** to unchecked and **Unsubscribed at** to the current time in Airtable. Signing up again checks **Email opt-in** again.

Text messages are separate: people reply STOP. Before sending any outreach email by hand, check **Email opt-in** on the person's Airtable record.

The page is excluded from search results (`noindex`). The code is in `src/pages/unsubscribe.astro` and `src/lib/unsubscribe.ts`.

## Project structure

```
src/
  styles/tokens.css           design tokens (colors, radii, layout)
  styles/global.css           base styles, buttons, form fields
  layouts/BaseLayout.astro    <head>, meta and Open Graph tags, fonts, analytics, header/footer
  components/                 Header, Hero, Benefits, Join (selector + form), Field, Footer, LegalPage
  scripts/waitlist-form.ts    form behavior (validation, states, payload)
  lib/submit-waitlist.ts      the one module that talks to the backend
  lib/unsubscribe.ts          posts unsubscribe requests (see Unsubscribing)
  pages/                      index, privacy, terms
public/                       favicon.svg (placeholder), og.png (link preview image)
og-image/og-image.html        source for public/og.png, with the command to re-render it
```

**Fonts:** Newsreader 400 and Inter Tight 400–600 come from Google Fonts through Astro's Fonts API. They're downloaded at build time and served from this site, so visitors' browsers never contact Google. Both are preloaded, use `font-display: swap`, and have size-matched fallbacks, so the page doesn't shift when they load. The build needs network access to fetch them.

## Design notes

### Where the build prompt and the design files disagreed

The design files won in every case:

1. **Text-card `aria-label`:** "Example of texting your doctor" (files). The prompt said "…your care team".
2. **Mobile hero card:** 20px corner radius, with 18px bubbles and a 6px tail (files). The prompt gave 24px and 20px for all sizes. Desktop uses 24px and 20px.
3. **Benefit card titles:** 24px on mobile and 27px on desktop (files). The prompt said 27px. Both now use the type scale below (24px).
4. **Success state:** includes a button below the message (files). The prompt didn't mention it. The files label it "Back to form"; the build says "Add another person", which says what it does.
5. **Mobile only:** a bottom border on the header and a divider above the footer's legal links (files).
6. **Values used in the files but missing from the token list:**
   - Link hover: `#0A403D`
   - Empty ring on an unselected card: `#A9CBC6`
   - Mobile footer divider: `#E0DCD1`
   - Employer panel radius: 14px
   - Membership card radius: 20px on desktop, 18px on mobile
7. **Newsreader optical size:** the HTML mockups load the font's optical-size axis, but the approved screenshots were rendered at its default size. With the axis on, the H1 sets wider and wraps differently. The build matches the screenshots.

### Type scale (differs from the canvas)

The canvas used 13–14 font sizes at each screen size, many only 1–2px apart, and display sizes up to 78px. The build uses one 7-step scale instead, defined as tokens in `src/styles/tokens.css` (`--fs-1` to `--fs-7`). Every `font-size` in the site uses one of these tokens, and each step is at least 3px from the next. Sizes are fixed per breakpoint, with no fluid `clamp()` in between.

| Token | Size | Desktop | Mobile |
|---|---|---|---|
| `--fs-1` | 13px | Small print, eyebrow labels | Same |
| `--fs-2` | 16px | Body, form and button text, bubbles, card text | Same, plus intro paragraphs |
| `--fs-3` | 20px | Intro paragraphs, small headings, footer name | Small headings, footer name |
| `--fs-4` | 24px | Card titles, wordmark, legal section headings | Same, plus "Your place is saved." |
| `--fs-5` | 32px | "Your place is saved." | Section headings, prices, legal H1 |
| `--fs-6` | 40px | Section headings, prices, legal H1 | H1 |
| `--fs-7` | 56px | H1 | Not used |

For comparison, the canvas had an H1 of 78 / 46 (desktop / mobile), section headings of 50–62 / 34–40, and prices of 52 / 42. GAL-301 still says "up to 78px desktop" and needs updating to match.

The hero switches to two columns at 960px (the canvas switched at about 750px), so "No waiting room." stays on one line at 56px.

### Where the build departs from the files, for accessibility

1. **Input borders** are `#878D93`, not `#9AA0A6`. The reference value is 2.6:1 against white, below the 3:1 that WCAG 1.4.11 requires for input borders. The new value is 3.35:1 on white and 3.08:1 on the employer panel. It's one token (`--field-border`) if you want to revert.
2. **Focus ring on the membership cards** is white. Teal-deep on teal-mid is 1.5:1, so the ring would be invisible on the teal section. Everywhere else it's 2px teal-deep with a 2px offset.
3. **Footer links** are 44px tall, not 40px, to meet the 44px tap-target rule. Their text still lines up with the company name; the disclaimer sits 4px lower.
4. **The "Revive Healthcare" wordmark** links to the home page and is padded to 44px tall. The text sits where it does in the design.
5. **The employee-count select** is the same height as the inputs. In the files it's 2px shorter, a side effect of how the mockup sized its boxes.

### Open questions

- **Number of employees** has no "Choose a range" placeholder, matching the files, so "1–10" is always preselected. That means the field can never be missing, and employers who skip it are recorded as 1–10. Adding a placeholder would make the requirement meaningful.
- **Error, loading and failure states** aren't designed yet (GAL-303). The current ones are provisional: error red `#B42318` (6.6:1 on white) with a `#FDF2F1` tint, inline messages with an icon, the failure message copy, and the button at 75% opacity while sending. GAL-303 also lists an error summary at the top of the form, and a note telling employers their two fields are required. Neither is built yet.

## TODO checklist

- [ ] **Form backend:** choose it and set `PUBLIC_FORM_ENDPOINT` (GAL-311).
- [x] **Privacy Statement and Terms of Service:** final text in `src/pages/privacy.astro` and `src/pages/terms.astro` (effective November 10, 2026). Update the `effectiveDate` on each page whenever the text changes.
- [x] **Link preview image:** `public/og.png` (1200×630), rendered from `og-image/og-image.html`.
- [ ] **Favicon:** replace the `public/favicon.svg` placeholder (GAL-305).
- [ ] **Form states:** apply the GAL-303 designs. Update `--error` and `--error-tint` in `tokens.css`, and the copy in `src/scripts/waitlist-form.ts`.
- [ ] **Analytics (optional):** pick a cookieless provider and set `PUBLIC_ANALYTICS_SRC`.
- [ ] **Copyright year:** the footer's © year is set when the site is built, so rebuild at least once a year.
