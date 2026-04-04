import crypto from 'node:crypto';

export const slugifyStoreName = (name) =>
  String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

export const generateStoreSlug = (name) => {
  const baseSlug = slugifyStoreName(name);
  const suffix = crypto.randomBytes(2).toString('hex');

  return `${baseSlug}-${suffix}`;
};

export const isValidStoreSlug = (slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*-[a-f0-9]{4}$/i.test(slug);
