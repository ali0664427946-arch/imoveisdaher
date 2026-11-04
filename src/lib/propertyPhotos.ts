export type PhotoWithOrder = { url: string; sort_order: number | null };

/** Returns photos ordered by sort_order (cover first). */
export function sortPhotos<T extends PhotoWithOrder>(photos: T[] | null | undefined): T[] {
  return [...(photos || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

/** Returns the cover photo URL (lowest sort_order). */
export function getCoverPhotoUrl(photos: PhotoWithOrder[] | null | undefined): string | undefined {
  return sortPhotos(photos)[0]?.url;
}
