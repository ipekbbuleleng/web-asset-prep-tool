export async function traceRasterToSvg(file, options = {}) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await loadImage(objectUrl);
    const sourceWidth = img.naturalWidth;
    const sourceHeight = img.naturalHeight;

    const traceWidth = clampNumber(Number(options.traceWidth), 64, 1024);
    const targetWidth = Math.min(traceWidth, sourceWidth);
    const targetHeight = Math.max(1, Math.round(sourceHeight * (targetWidth / sourceWidth)));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("Browser tidak dapat membuat canvas untuk tracing.");
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (!options.transparentBackground) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    const threshold = clampNumber(Number(options.threshold), 0, 255);
    const invert = !!options.invert;
    const fillColor = normalizeHexColor(options.fillColor || "#111827");

    const pathData = [];
    const colorBuckets = new Set();

    let activePixelCount = 0;
    let transparentPixelCount = 0;
    let runCount = 0;

    for (let y = 0; y < targetHeight; y += 1) {
      let runStart = -1;

      for (let x = 0; x < targetWidth; x += 1) {
        const idx = (y * targetWidth + x) * 4;
        const r = imageData.data[idx];
        const g = imageData.data[idx + 1];
        const b = imageData.data[idx + 2];
        const a = imageData.data[idx + 3];

        if (a <= 24) {
          transparentPixelCount += 1;
        } else if (colorBuckets.size <= 768) {
          colorBuckets.add(`${Math.round(r / 32)}-${Math.round(g / 32)}-${Math.round(b / 32)}`);
        }

        const intensity = 0.299 * r + 0.587 * g + 0.114 * b;
        const active = a > 24 && (invert ? intensity > threshold : intensity < threshold);

        if (active) {
          activePixelCount += 1;
          if (runStart === -1) runStart = x;
        }

        const isLast = x === targetWidth - 1;
        if ((!active || isLast) && runStart !== -1) {
          const runEnd = active && isLast ? x + 1 : x;
          const width = runEnd - runStart;

          if (width > 0) {
            pathData.push(`M${runStart} ${y}h${width}v1h-${width}z`);
            runCount += 1;
          }

          runStart = -1;
        }
      }
    }

    const pixelCount = targetWidth * targetHeight;
    const title = escapeXml(options.title || "Traced SVG");
    const background = options.transparentBackground
      ? ""
      : `<rect width="100%" height="100%" fill="#ffffff"/>`;

    const path = pathData.length
      ? `<path fill="${fillColor}" d="${pathData.join("")}"/>`
      : "";

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${targetWidth}" height="${targetHeight}" viewBox="0 0 ${targetWidth} ${targetHeight}" role="img"><title>${title}</title>${background}${path}</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });

    return {
      svg,
      blob,
      meta: {
        sourceWidth,
        sourceHeight,
        width: targetWidth,
        height: targetHeight,
        pixelCount,
        activePixelCount,
        activeRatio: pixelCount ? activePixelCount / pixelCount : 0,
        transparentPixelCount,
        transparentRatio: pixelCount ? transparentPixelCount / pixelCount : 0,
        runCount,
        colorBucketCount: colorBuckets.size,
        threshold,
        fillColor,
        invert,
        transparentBackground: !!options.transparentBackground,
        outputSize: blob.size
      }
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function svgTextToObjectUrl(svgText) {
  const blob = new Blob([svgText], { type: "image/svg+xml" });
  return URL.createObjectURL(blob);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gambar tidak dapat dibaca untuk tracing."));
    img.src = url;
  });
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function normalizeHexColor(value) {
  const text = String(value || "").trim();

  if (/^#[0-9a-f]{6}$/i.test(text)) return text;
  if (/^#[0-9a-f]{3}$/i.test(text)) {
    return "#" + text.slice(1).split("").map((char) => char + char).join("");
  }

  return "#111827";
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
