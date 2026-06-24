# Wayfarer Static Blog

Astro static copy of `https://wayfarer.ktz.me/`.

## Quick Start

```sh
npm ci
npm run dev
```

Production build:

```sh
npm run build:production
```

Push to `main` to publish. GitHub Actions builds with Node `24.18.0` and deploys `dist/` to Cloudflare Pages project `blog-mum`.

## Posts

Edit posts in `src/data/site.json` under `posts`.

Fastest new-post path: copy an existing post object and change `id`, `slug`, `title`, `html`, `plaintext`, `excerpt`, `feature_image`, dates, `author_id`, and `status`.

Missing `status` means published. Use this for drafts:

```json
"status": "draft"
```

Drafts are hidden from production pages, RSS, author pages, and post routes. Preview drafts locally with:

```sh
npm run dev:drafts
```

To publish a draft, change `"status": "draft"` to `"status": "published"` or remove the field.

## Authors

Authors live in `src/data/site.json` under `authors`.

Each post uses `author_id` to pick an author:

```json
"author_id": "1"
```

Current author:

```json
{ "id": "1", "name": "Ann Kretzschmar", "slug": "ann" }
```

Author pages are generated from the authors list and only show posts for that author.

## Images

Image source files live outside the repo here:

```sh
../original/images/
```

The repo sees them through:

```sh
public/content/images -> ../../../original/images
```

For a new image, put the original in a dated folder:

```sh
../original/images/2026/06/my-photo.jpg
```

Reference it in posts as:

```txt
/content/images/2026/06/my-photo.jpg
```

Then generate/check local responsive copies and upload everything to the EU R2 bucket:

```sh
npm run fix:images
npm run check:images
npm run upload:r2
```

Production serves images from:

```sh
https://assets.wayfarer.ktz.me
```

## Publish Flow

1. Add or edit the post in `src/data/site.json`.
2. Keep it as `"status": "draft"` while working.
3. Add images under `../original/images/YYYY/MM/`.
4. Preview drafts with `npm run dev:drafts`.
5. Run image prep:

```sh
npm run fix:images
npm run check:images
npm run upload:r2
```

6. Publish the post by setting `"status": "published"` or removing `status`.
7. Build locally:

```sh
npm run build:production
```

8. Commit and push:

```sh
git add src/data/site.json
git commit -m "Publish <post title>"
git push origin main
```

GitHub Actions deploys automatically after the push.

## Notes

`npm run import:ghost` re-imports from `../original/ghost.db` and rewrites `src/data/site.json`. Do not use it for normal posting.
