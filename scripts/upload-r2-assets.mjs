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

function putObject(filePath) {
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

async function main() {
  const files = walk(sourceRoot).sort();
  let nextIndex = 0;
  let uploaded = 0;
  let uploadedBytes = 0;

  async function worker() {
    while (nextIndex < files.length) {
      const index = nextIndex;
      nextIndex += 1;
      const result = await putObject(files[index]);
      uploaded += 1;
      uploadedBytes += result.size;
      if (uploaded === 1 || uploaded % 25 === 0 || uploaded === files.length) {
        const mib = (uploadedBytes / 1024 / 1024).toFixed(1);
        console.log(`${uploaded}/${files.length} uploaded (${mib} MiB): ${result.key}`);
      }
    }
  }

  console.log(`Uploading ${files.length} files from ${sourceRoot}`);
  console.log(`Target: ${bucket} (${jurisdiction}) with keys under content/images/`);
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
