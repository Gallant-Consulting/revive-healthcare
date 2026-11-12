// @ts-check
import { defineConfig, envField, fontProviders } from 'astro/config';

export default defineConfig({
  // Absolute site URL, used for canonical and Open Graph URLs. Set SITE_URL in the
  // host's build settings (e.g. https://staging.revivehealthcare.com).
  site: process.env.SITE_URL || undefined,
  output: 'static',
  build: {
    // One small page: inlining the CSS saves a render-blocking request on mobile.
    inlineStylesheets: 'always',
  },
  env: {
    schema: {
      PUBLIC_FORM_ENDPOINT: envField.string({ context: 'client', access: 'public', optional: true, url: true }),
      PUBLIC_ANALYTICS_SRC: envField.string({ context: 'client', access: 'public', optional: true, url: true }),
      PUBLIC_UNSUBSCRIBE_ENDPOINT: envField.string({ context: 'client', access: 'public', optional: true, url: true }),
    },
  },
  // Google Fonts, downloaded at build time and served from this site (no request to
  // Google from the visitor's browser). font-display defaults to swap.
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Newsreader',
      cssVariable: '--font-newsreader',
      weights: [400],
      styles: ['normal'],
      subsets: ['latin'],
      // Default optical size only. The approved screenshots were rendered without
      // Newsreader's opsz axis; with it, large headings set wider and wrap differently.
      fallbacks: ['Georgia', 'serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'Inter Tight',
      cssVariable: '--font-inter-tight',
      weights: ['400 600'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
  ],
});
