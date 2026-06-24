import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const publicRoot = join(projectRoot, 'public');
const data = JSON.parse(readFileSync(join(projectRoot, 'src', 'data', 'site.json'), 'utf8'));
const mode = process.argv[2] || 'check';
const liveBase = 'https://wayfarer.ktz.me';

function collectReferencedImages() {
  const urls = new Set();

  function add(url) {
    if (url && url.startsWith('/content/images/')) urls.add(url);
  }

  function addFromHtml(html = '') {
    for (const match of html.matchAll(/(?:src|href)="(\/content\/images\/[^"]+)"/g)) add(match[1]);
    for (const match of html.matchAll(/srcset="([^"]+)"/g)) {
      for (const candidate of match[1].split(',')) {
        add(candidate.trim().split(/\s+/)[0]);
      }
    }
  }

  add(data.site.cover_image);
  for (const author of data.authors) {
    add(author.profile_image);
    add(author.cover_image);
    if (author.profile_image) add(author.profile_image.replace('/content/images/', '/content/images/size/w100/'));
  }

  for (const post of data.posts) {
    add(post.feature_image);
    for (const width of [300, 600, 1000, 2000]) {
      if (post.feature_image) add(post.feature_image.replace('/content/images/', `/content/images/size/w${width}/`));
    }
    addFromHtml(post.html);
  }

  return [...urls].sort();
}

function missingImages() {
  return collectReferencedImages().filter((url) => !existsSync(join(publicRoot, url)));
}

function originalForSizeUrl(url) {
  const match = url.match(/^\/content\/images\/size\/w(\d+)\/(.+)$/);
  if (!match) return null;
  return {
    width: match[1],
    originalUrl: `/content/images/${match[2]}`,
  };
}

function fetchFromLive(url, target) {
  execFileSync('curl', ['-fL', '--retry', '2', '--retry-delay', '1', '-sS', '-o', target, `${liveBase}${url}`], {
    stdio: 'pipe',
  });
}

function generateFromOriginal(url, target) {
  const original = originalForSizeUrl(url);
  if (!original) return false;

  const originalPath = join(publicRoot, original.originalUrl);
  if (!existsSync(originalPath)) return false;

  execFileSync('/usr/bin/sips', ['--resampleWidth', original.width, originalPath, '--out', target], {
    stdio: 'pipe',
  });
  return true;
}

async function main() {
  const missing = missingImages();

  if (mode === 'check') {
    console.log(JSON.stringify({ referenced: collectReferencedImages().length, missingCount: missing.length, missing }, null, 2));
    process.exit(missing.length ? 1 : 0);
  }

  if (mode !== 'fix') {
    console.error(`Unknown mode: ${mode}`);
    process.exit(2);
  }

  let downloaded = 0;
  let generated = 0;
  const failed = [];

  for (const url of missing) {
    const target = join(publicRoot, url);
    mkdirSync(dirname(target), { recursive: true });

    try {
      fetchFromLive(url, target);
      downloaded += 1;
      continue;
    } catch {
      try {
        if (generateFromOriginal(url, target)) {
          generated += 1;
          continue;
        }
      } catch {
        // Fall through to the failure list below.
      }
    }

    failed.push(url);
  }

  const remaining = missingImages();
  console.log(JSON.stringify({ attempted: missing.length, downloaded, generated, failed, remainingCount: remaining.length, remaining }, null, 2));
  process.exit(remaining.length ? 1 : 0);
}

main();
