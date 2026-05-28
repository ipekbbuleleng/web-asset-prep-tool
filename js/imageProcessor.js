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
    const backgroundRemoval = normalizeBackgroundRemovalOptions(options.backgroundRemoval);
    const outputMimeType = backgroundRemoval.enabled && options.mimeType === "image/jpeg"
      ? "image/png"
      : options.mimeType;

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d", {
      alpha: outputMimeType !== "image/jpeg",
      desynchronized: true,
      willReadFrequently: backgroundRemoval.enabled
    });

    if (!ctx) {
      throw new Error("Browser tidak dapat membuat canvas untuk memproses gambar.");
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (outputMimeType === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    let backgroundRemovalResult = null;
    if (backgroundRemoval.enabled) {
      backgroundRemovalResult = applyBackgroundRemoval(ctx, canvas, backgroundRemoval);
    }

    const quality = clampNumber(Number(options.quality) / 100, 0.4, 1);
    const blob = await canvasToBlob(canvas, outputMimeType, quality);

    if (!blob) {
      throw new Error("Browser gagal membuat file output. Coba gunakan format PNG atau JPG.");
    }

    return {
      blob,
      backgroundRemoval: backgroundRemovalResult,
      outputMeta: {
        width: targetWidth,
        height: targetHeight,
        size: blob.size,
        type: blob.type || outputMimeType
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

function applyBackgroundRemoval(ctx, canvas, options) {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const targetColor = options.mode === "manual"
    ? hexToRgb(options.color)
    : detectCornerBackgroundColor(data, canvas.width, canvas.height);

  const toleranceDistance = clampNumber(options.tolerance, 0, 100) / 100 * 441.67295593;
  const featherDistance = clampNumber(options.feather, 0, 100) / 100 * 160;
  const totalPixels = canvas.width * canvas.height;

  let transparentPixels = 0;
  let partialAlphaPixels = 0;

  for (let idx = 0; idx < data.length; idx += 4) {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];

    if (a === 0) {
      transparentPixels += 1;
      continue;
    }

    const distance = colorDistance(r, g, b, targetColor.r, targetColor.g, targetColor.b);

    if (distance <= toleranceDistance) {
      data[idx + 3] = 0;
      transparentPixels += 1;
      continue;
    }

    if (featherDistance > 0 && distance <= toleranceDistance + featherDistance) {
      const ratio = (distance - toleranceDistance) / featherDistance;
      const nextAlpha = Math.max(0, Math.min(a, Math.round(a * ratio)));
      if (nextAlpha < a) {
        data[idx + 3] = nextAlpha;
        partialAlphaPixels += 1;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  return {
    mode: options.mode,
    targetColor: rgbToHex(targetColor),
    tolerance: options.tolerance,
    feather: options.feather,
    transparentPixels,
    partialAlphaPixels,
    totalPixels,
    transparentPercent: totalPixels ? transparentPixels / totalPixels * 100 : 0,
    partialAlphaPercent: totalPixels ? partialAlphaPixels / totalPixels * 100 : 0
  };
}

function detectCornerBackgroundColor(data, width, height) {
  const sampleSize = Math.max(2, Math.min(16, Math.round(Math.min(width, height) * 0.04)));
  const samples = [];

  const areas = [
    [0, 0],
    [width - sampleSize, 0],
    [0, height - sampleSize],
    [width - sampleSize, height - sampleSize]
  ];

  for (const [startX, startY] of areas) {
    for (let y = Math.max(0, startY); y < Math.min(height, startY + sampleSize); y += 1) {
      for (let x = Math.max(0, startX); x < Math.min(width, startX + sampleSize); x += 1) {
        const idx = (y * width + x) * 4;
        const a = data[idx + 3];

        if (a > 16) {
          samples.push({
            r: data[idx],
            g: data[idx + 1],
            b: data[idx + 2]
          });
        }
      }
    }
  }

  if (samples.length === 0) {
    return { r: 255, g: 255, b: 255 };
  }

  const sum = samples.reduce((acc, item) => {
    acc.r += item.r;
    acc.g += item.g;
    acc.b += item.b;
    return acc;
  }, { r: 0, g: 0, b: 0 });

  return {
    r: Math.round(sum.r / samples.length),
    g: Math.round(sum.g / samples.length),
    b: Math.round(sum.b / samples.length)
  };
}

function normalizeBackgroundRemovalOptions(value) {
  if (!value || !value.enabled) {
    return {
      enabled: false,
      mode: "auto",
      color: "#ffffff",
      tolerance: 24,
      feather: 12
    };
  }

  return {
    enabled: true,
    mode: value.mode === "manual" ? "manual" : "auto",
    color: normalizeHexColor(value.color || "#ffffff"),
    tolerance: clampNumber(Number(value.tolerance), 0, 100),
    feather: clampNumber(Number(value.feather), 0, 100)
  };
}

function colorDistance(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt(
    ((r1 - r2) ** 2) +
    ((g1 - g2) ** 2) +
    ((b1 - b2) ** 2)
  );
}

function hexToRgb(hex) {
  const clean = normalizeHexColor(hex).slice(1);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }) {
  return "#" + [r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"))
    .join("");
}

function normalizeHexColor(value) {
  const text = String(value || "").trim();

  if (/^#[0-9a-f]{6}$/i.test(text)) return text.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(text)) {
    return "#" + text.slice(1).split("").map((char) => char + char).join("").toLowerCase();
  }

  return "#ffffff";
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
