# Waitlist emails

The three emails sent when someone joins the waitlist on rhcproviders.com:

| Email | Sent to | When |
|---|---|---|
| Individual confirmation | The person who signed up | Plan is Individual |
| Employer confirmation | The person who signed up | Plan is Employer |
| Team notice | internal@rhcproviders.com | Every sign-up |

The two confirmations end with an **Unsubscribe** link to `rhcproviders.com/unsubscribe?id=<Airtable record ID>` (see the site README).

They're sent from office@rhcproviders.com through Mailjet (the **RHC Providers** credential) by the n8n workflow **Revive Healthcare: waitlist sign-ups** on n8n.workgallantly.com.

## Files

- `templates.mjs`: the templates. Each email has a subject, an HTML version styled like the site (colors from `site/src/styles/tokens.css`) and a plain-text version. Everything typed into the form is HTML-escaped before it goes into an email.
- `preview.mjs`: renders sample emails and builds the code for n8n.

## Changing an email

1. Edit `templates.mjs`.
2. Run `node emails/preview.mjs` from the repo root. Previews land in `emails/preview/` (open the `.html` files in a browser), including an "escaping" sample with hostile input to confirm nothing renders as markup.
3. Copy `emails/dist/build-emails.n8n.js` into the **Build emails** Code node in the n8n workflow, run a test, and publish.

`emails/preview/` and `emails/dist/` are generated and not committed.

## Fonts

Most email clients ignore web fonts, so the emails name Newsreader and Inter Tight first and fall back to Georgia and Helvetica/Arial. They don't load fonts from Google, which would expose recipients' IP addresses.
