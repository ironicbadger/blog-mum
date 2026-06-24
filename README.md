# The Misadventures of a Heuchera Addict

Static Astro copy of the former Ghost site at `https://wayfarer.ktz.me/`.

## Development

```sh
npm ci
npm run dev
```

The local development build uses `/content/images/...` from `public/content/images`, which is a local symlink to the extracted Ghost image archive.

## Production

Production images are served from the EU `wayfarer` R2 bucket through:

```sh
https://assets.wayfarer.ktz.me
```

Upload the local image archive to R2 with:

```sh
npm run upload:r2
```

GitHub Actions builds and deploys `main` to the Cloudflare Pages project `blog-mum`.
The workflow uses a repository secret named `CLOUDFLARE_API_TOKEN`
with Cloudflare Pages edit access for account `87f000053c6198ee887e7781685c58f1`.

Build settings:

```sh
npm run build:production
```

Output directory:

```sh
dist
```
