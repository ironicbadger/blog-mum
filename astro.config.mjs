import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://wayfarer.ktz.me',
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap()],
});
