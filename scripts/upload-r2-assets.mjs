import { spawn } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourceRoot = resolve(projectRoot, '..', 'original', 'images');
const bucket = process.env.R2_BUCKET || 'wayfarer';
const jurisdiction = process.env.R2_JURISDICTION || 'eu';
const concurrency = Number.parseInt(process.env.R2_UPLOAD_CONCURRENCY || '6', 10);
const cacheControl = process.env.R2_CACHE_CONTROL || 'public, max-age=31536000, immutable';
const publicBase = (process.env.R2_PUBLIC_BASE || 'https://assets.wayfarer.ktz.me').replace(/\/$/, '');
const skipExisting = process.env.R2_SKIP_EXISTING !== 'false';
const maxAttempts = Number.parseInt(process.env.R2_UPLOAD_ATTEMPTS || '4', 10);

const contentTypes = new Map([
  ['.avif', 'image/avif'],
  ['.gif', 'image/gif'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
]);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    if (!entry.isFile()) return [];
    return [fullPath];
  });
}

function keyFor(filePath) {
  return `content/images/${relative(sourceRoot, filePath).split(sep).join('/')}`;
}

function publicUrlFor(key) {
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return `${publicBase}/${encodedKey}?r2-check=${Date.now()}`;
}

async function objectExists(key) {
  if (!skipExisting) return false;
  try {
    const response = await fetch(publicUrlFor(key), {
      method: 'HEAD',
      signal: AbortSignal.timeout(20000),
    });
    if (response.ok) return true;
    if (response.status !== 404) {
      console.warn(`HEAD ${key} returned ${response.status}; uploading anyway`);
    }
  } catch (error) {
    console.warn(`HEAD ${key} failed; uploading anyway: ${error.message}`);
  }
  return false;
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function putObjectOnce(filePath) {
  const key = keyFor(filePath);
  const args = [
    'wrangler',
    'r2',
    'object',
    'put',
    `${bucket}/${key}`,
    '--remote',
    '--jurisdiction',
    jurisdiction,
    '--file',
    filePath,
    '--cache-control',
    cacheControl,
  ];
  const contentType = contentTypes.get(extname(filePath).toLowerCase());
  if (contentType) args.push('--content-type', contentType);

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('npx', ['--yes', ...args], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.on('error', rejectPromise);
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise({ key, size: statSync(filePath).size });
        return;
      }
      rejectPromise(new Error(`Upload failed for ${key}\n${output.trim()}`));
    });
  });
}

async function putObject(filePath) {
  const key = keyFor(filePath);

  if (await objectExists(key)) {
    return { key, size: statSync(filePath).size, skipped: true };
  }

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return { ...(await putObjectOnce(filePath)), skipped: false };
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        const delay = 1000 * attempt * attempt;
        console.warn(`Retrying ${key} after attempt ${attempt}/${maxAttempts}: ${error.message.split('\n')[0]}`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

async function main() {
  const files = walk(sourceRoot).sort();
  let nextIndex = 0;
  let uploaded = 0;
  let skipped = 0;
  let completed = 0;
  let uploadedBytes = 0;

  async function worker() {
    while (nextIndex < files.length) {
      const index = nextIndex;
      nextIndex += 1;
      const result = await putObject(files[index]);
      completed += 1;
      if (result.skipped) {
        skipped += 1;
      } else {
        uploaded += 1;
        uploadedBytes += result.size;
      }
      if (completed === 1 || completed % 25 === 0 || completed === files.length) {
        const mib = (uploadedBytes / 1024 / 1024).toFixed(1);
        console.log(`${completed}/${files.length} done (${uploaded} uploaded, ${skipped} skipped, ${mib} MiB sent): ${result.key}`);
      }
    }
  }

  console.log(`Uploading ${files.length} files from ${sourceRoot}`);
  console.log(`Target: ${bucket} (${jurisdiction}) with keys under content/images/`);
  console.log(`Skip existing: ${skipExisting ? `yes via ${publicBase}` : 'no'}`);
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
