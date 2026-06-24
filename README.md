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

Cloudflare Pages should use:

```sh
npm run build:production
```

with output directory:

```sh
dist
```
