/**
 * Apply watermark to an image file using Canvas
 * @param file - The original image file
 * @param watermarkSrc - The watermark image source URL
 * @param opacity - Watermark opacity (0 to 1)
 * @returns Promise<File> - The watermarked image as a new File
 */
export async function applyWatermark(
  file: File,
  watermarkSrc: string,
  opacity: number = 0.5
): Promise<File> {
  return new Promise((resolve, reject) => {
    // Load the original image
    const img = new Image();
    img.onload = () => {
      // Load the watermark
      const watermark = new Image();
      watermark.crossOrigin = "anonymous";
      watermark.onload = () => {
        // Create canvas with original image dimensions
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // Draw the original image
        ctx.drawImage(img, 0, 0);

        // Calculate watermark size - 40% of image width for better visibility
        const targetWatermarkWidth = Math.min(img.width * 0.4, 600);
        const aspectRatio = watermark.height / watermark.width;
        const watermarkWidth = targetWatermarkWidth;
        const watermarkHeight = watermarkWidth * aspectRatio;

        // Calculate center position
        const x = (img.width - watermarkWidth) / 2;
        const y = (img.height - watermarkHeight) / 2;

        // Set opacity and draw watermark centered
        ctx.globalAlpha = opacity;
        ctx.drawImage(watermark, x, y, watermarkWidth, watermarkHeight);
        ctx.globalAlpha = 1;

        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Could not create blob from canvas"));
              return;
            }
            // Create new file with same name
            const watermarkedFile = new File([blob], file.name, {
              type: file.type,
            });
            resolve(watermarkedFile);
          },
          file.type,
          0.92 // Quality for JPEG
        );
      };

      watermark.onerror = () => {
        console.warn("Could not load watermark, returning original file");
        resolve(file);
      };

      watermark.src = watermarkSrc;
    };

    img.onerror = () => {
      reject(new Error("Could not load original image"));
    };

    img.src = URL.createObjectURL(file);
  });
}
