const assetBase = (import.meta.env.PUBLIC_ASSET_BASE || '').replace(/\/$/, '');

export function withAssetBase(value?: string | null) {
  if (!value || !assetBase) return value || '';
  return value.replaceAll('/content/images/', `${assetBase}/content/images/`);
}

export function imagePath(path?: string | null, width?: number) {
  if (!path) return '';
  const localPath = path.replace(/^https:\/\/wayfarer\.ktz\.me/, '').replace(/^__GHOST_URL__/, '');
  const sizedPath = width ? localPath.replace('/content/images/', `/content/images/size/w${width}/`) : localPath;
  return sizedPath.startsWith('/content/images/') && assetBase ? `${assetBase}${sizedPath}` : sizedPath;
}

export function imageSrcset(path?: string | null, widths = [300, 600, 1000, 2000]) {
  if (!path) return '';
  return widths.map((width) => `${imagePath(path, width)} ${width}w`).join(',\n');
}

export function absoluteImage(siteUrl: string, path?: string | null) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  if (path.startsWith('/content/images/') && assetBase) return `${assetBase}${path}`;
  return `${siteUrl}${path}`;
}
