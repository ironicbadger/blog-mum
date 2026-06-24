import { existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const copiedImages = join(projectRoot, 'dist', 'content', 'images');

if (existsSync(copiedImages)) {
  rmSync(copiedImages, { recursive: true, force: true });
  console.log('Removed copied local images from dist; production images are served from R2.');
}
