const MIME_EXTENSION = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png"
};

export function getOutputExtension(mimeType) {
  return MIME_EXTENSION[mimeType] || "webp";
}

export function isSupportedImage(file) {
  const supportedTypes = ["image/jpeg", "image/png", "image/webp"];
  const name = String(file?.name || "").toLowerCase();
  const type = String(file?.type || "").toLowerCase();

  return (
    supportedTypes.includes(type) ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp")
  );
}

export async function readImageMeta(file) {
  const url = URL.createObjectURL(file);

  try {
    const img = await loadImage(url);

    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      objectUrl: url
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export async function processImageFile(file, options) {
  if (!isSupportedImage(file)) {
    throw new Error("Format gambar belum didukung. Gunakan JPG, PNG, atau WebP.");
  }

  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(sourceUrl);
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;

    const requestedWidth = clampNumber(Number(options.width), 64, 5000);
    const targetWidth = options.preventUpscale
      ? Math.min(requestedWidth, sourceWidth)
      : requestedWidth;

    const targetHeight = Math.max(1, Math.round(sourceHeight * (targetWidth / sourceWidth)));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d", {
      alpha: options.mimeType !== "image/jpeg",
      desynchronized: true
    });

    if (!ctx) {
      throw new Error("Browser tidak dapat membuat canvas untuk memproses gambar.");
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (options.mimeType === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    const quality = clampNumber(Number(options.quality) / 100, 0.4, 1);
    const blob = await canvasToBlob(canvas, options.mimeType, quality);

    if (!blob) {
      throw new Error("Browser gagal membuat file output. Coba gunakan format PNG atau JPG.");
    }

    return {
      blob,
      outputMeta: {
        width: targetWidth,
        height: targetHeight,
        size: blob.size,
        type: blob.type || options.mimeType
      },
      sourceMeta: {
        width: sourceWidth,
        height: sourceHeight,
        size: file.size,
        type: file.type
      }
    };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gambar tidak dapat dibaca."));
    img.src = url;
  });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}
