import { describe, it, expect } from "vitest";
import { getCoverPhotoUrl } from "@/lib/propertyPhotos";

describe("getCoverPhotoUrl", () => {
  it("returns the photo with sort_order 0 even when it is not first in the list", () => {
    const photos = [
      { url: "ultima.webp", sort_order: 14 },
      { url: "capa.webp", sort_order: 0 },
      { url: "segunda.webp", sort_order: 1 },
    ];
    expect(getCoverPhotoUrl(photos)).toBe("capa.webp");
  });
});
