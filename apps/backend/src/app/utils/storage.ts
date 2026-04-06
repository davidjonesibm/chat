/**
 * Strips the origin from a Supabase storage URL, keeping only the pathname.
 * Used when storing URLs in the database.
 * If the input is already a pathname (starts with /), returns it as-is.
 */
export function toStoragePath(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) {
    return new URL(url).pathname;
  }
  return url;
}
