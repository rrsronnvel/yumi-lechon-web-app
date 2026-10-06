/**
 * Client-Side Image Pre-Compression Utility
 * Compresses incoming booking screenshots using an off-screen HTML5 Canvas.
 * - Caps maximum dimension (width or height) to 1600px while preserving aspect ratio.
 * - Fills white background to ensure transparent PNGs don't become black in JPEG.
 * - Encodes as image/jpeg with 0.82 quality, reducing 3MB-8MB screenshots to ~150KB-250KB.
 * - Retains crystal-clear text readability for OCR and Multimodal Vision.
 * - Safely returns original file if compression fails or if image is already small.
 */
export async function compressScreenshot(
  file: File,
  maxDimension = 1600,
  quality = 0.82
): Promise<File> {
  // If not an image or already a tiny JPEG (< 150KB), return as is
  if (!file.type.startsWith("image/") || (file.size < 150 * 1024 && file.type === "image/jpeg")) {
    return file;
  }

  return new Promise<File>((resolve) => {
    try {
      const reader = new FileReader();

      reader.onload = (event) => {
        const img = new Image();

        img.onload = () => {
          try {
            let width = img.width;
            let height = img.height;

            // Compute proportional scaling
            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              } else {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
              }
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
              resolve(file);
              return;
            }

            // Fill white background in case of transparent PNG screenshots
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, width, height);

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
              (blob) => {
                if (!blob || blob.size >= file.size) {
                  // If compressed output is somehow larger than original, keep original
                  resolve(file);
                  return;
                }

                const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
                const compressedFile = new File([blob], newFileName, {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                });

                resolve(compressedFile);
              },
              "image/jpeg",
              quality
            );
          } catch {
            resolve(file);
          }
        };

        img.onerror = () => resolve(file);
        img.src = event.target?.result as string;
      };

      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    } catch {
      resolve(file);
    }
  });
}
