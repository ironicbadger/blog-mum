import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(root, '..');
const workRoot = resolve(projectRoot, '..');
const dbPath = resolve(workRoot, 'original', 'ghost.db');
const outputPath = resolve(projectRoot, 'src', 'data', 'site.json');
const publicRoot = resolve(projectRoot, 'public');
const ghostUrlToken = '__GHOST_URL__';
const siteUrl = 'https://wayfarer.ktz.me';
const imageDimensions = new Map();

function query(sql) {
  const out = execFileSync('sqlite3', ['-json', dbPath, sql], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  }).trim();
  return out ? JSON.parse(out) : [];
}

function localize(value) {
  if (!value) return value;
  return value.replaceAll(`${ghostUrlToken}/`, '/').replaceAll(`${siteUrl}/`, '/').replaceAll(ghostUrlToken, '');
}

function dimensionsForImage(src) {
  if (!src || !src.startsWith('/content/images/')) return null;
  const file = join(publicRoot, src);
  if (imageDimensions.has(file)) return imageDimensions.get(file);
  if (!existsSync(file)) return null;

  const output = execFileSync('/usr/bin/sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], {
    encoding: 'utf8',
  });
  const dimensions = {
    width: Number(output.match(/pixelWidth:\s*(\d+)/)?.[1]),
    height: Number(output.match(/pixelHeight:\s*(\d+)/)?.[1]),
  };
  imageDimensions.set(file, dimensions);
  return dimensions;
}

function upsertAttribute(tag, name, value) {
  if (new RegExp(`\\s${name}="[^"]*"`).test(tag)) {
    return tag.replace(new RegExp(`\\s${name}="[^"]*"`), ` ${name}="${value}"`);
  }
  return tag.replace(/\s*\/?>$/, (ending) => ` ${name}="${value}"${ending}`);
}

function normalizeImageDimensions(html) {
  return html.replace(/<img\b[^>]*>/g, (tag) => {
    const src = tag.match(/\ssrc="([^"]+)"/)?.[1];
    const dimensions = dimensionsForImage(src);
    if (!dimensions?.width || !dimensions?.height) return tag;

    let normalized = upsertAttribute(tag, 'width', dimensions.width);
    normalized = upsertAttribute(normalized, 'height', dimensions.height);
    return normalized;
  });
}

function excerpt(plaintext) {
  const text = (plaintext || '').replace(/\s+/g, ' ').trim();
  if (text.length <= 245) return text;
  return text.slice(0, 245).replace(/\s+\S*$/, '').trim();
}

function readingTime(plaintext, html) {
  const words = (plaintext || '').trim().split(/\s+/).filter(Boolean).length;
  const imageCount = ((html || '').match(/<img\b/gi) || []).length;
  const imageSeconds = Array.from({ length: imageCount }, (_, index) => Math.max(12 - index, 3))
    .reduce((total, seconds) => total + seconds, 0);
  return Math.max(1, Math.ceil(words / 275 + imageSeconds / 60));
}

const liveReadingMinutes = {
  'what-i-did-during-lockdown': 4,
  'battling-the-evil-weevil': 4,
  'christmas-is-coming': 14,
  'remembrance-sunday-in-borrowdale': 4,
  'autumn-colours': 3,
  'some-new-additions': 5,
  'just-for-a-change': 6,
  'the-front-garden': 3,
  'how-things-have-changed': 3,
  'lets-start-at-the-very-beginning-2': 2,
  'flowers-as-well-as-spectacular-foliage-2': 2,
};

function dateOnly(value) {
  return value ? value.slice(0, 10) : '';
}

const settingsRows = query(`
  select key, value
  from settings
  where key in ('title','description','cover_image','icon','logo','accent_color','facebook','twitter','navigation','secondary_navigation','timezone')
`);

const settings = Object.fromEntries(settingsRows.map((row) => [row.key, localize(row.value)]));
settings.navigation = JSON.parse(settings.navigation || '[]').map((item) => ({
  label: item.label,
  url: localize(item.url),
}));
settings.secondary_navigation = JSON.parse(settings.secondary_navigation || '[]').map((item) => ({
  label: item.label,
  url: localize(item.url),
}));

const authors = query(`
  select id, name, slug, profile_image, cover_image, bio, location, website, facebook, twitter
  from users
`).map((author) => ({
  ...author,
  profile_image: localize(author.profile_image),
  cover_image: localize(author.cover_image),
}));

const posts = query(`
  select
    p.id,
    p.slug,
    p.title,
    p.html,
    p.plaintext,
    p.feature_image,
    p.published_at,
    p.updated_at,
    p.custom_excerpt,
    p.author_id,
    u.slug as author_slug,
    u.name as author_name
  from posts p
  join users u on u.id = p.author_id
  where p.type = 'post' and p.status = 'published'
  order by p.published_at desc
`).map((post) => {
  const html = normalizeImageDimensions(localize(post.html || ''));
  return {
    ...post,
    html,
    feature_image: localize(post.feature_image),
    excerpt: post.custom_excerpt || excerpt(post.plaintext),
    reading_minutes: liveReadingMinutes[post.slug] || readingTime(post.plaintext, html),
    published_date: dateOnly(post.published_at),
    updated_date: dateOnly(post.updated_at),
  };
});

const data = {
  site: {
    title: settings.title,
    description: settings.description,
    url: siteUrl,
    cover_image: settings.cover_image,
    icon: settings.icon,
    logo: settings.logo,
    accent_color: settings.accent_color || '#15171A',
    facebook: settings.facebook,
    twitter: settings.twitter,
    navigation: settings.navigation,
    secondary_navigation: settings.secondary_navigation,
    timezone: settings.timezone,
  },
  authors,
  posts,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`);
