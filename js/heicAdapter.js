const HEIC_MIME_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence"
]);

const LOCAL_HEIC2ANY_URL = "./vendor/heic2any.min.js";
const CDN_HEIC2ANY_URL = "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js";

let heicLoaderPromise = null;

export function isHeicFile(file) {
  if (!file) return false;

  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();

  return (
    HEIC_MIME_TYPES.has(type) ||
    name.endsWith(".heic") ||
    name.endsWith(".heif") ||
    name.endsWith(".heics") ||
    name.endsWith(".heifs")
  );
}

export function getReadableMimeLabel(file) {
  if (isHeicFile(file)) {
    return file.type || "image/heic atau image/heif";
  }

  return file?.type || "unknown";
}

export async function convertHeicToJpegFile(file, options = {}) {
  if (!isHeicFile(file)) return file;

  const heic2any = await loadHeic2Any();
  const quality = Number.isFinite(Number(options.quality))
    ? Math.min(Math.max(Number(options.quality), 0.5), 0.98)
    : 0.92;

  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality
  });

  const blob = Array.isArray(converted) ? converted[0] : converted;

  if (!blob || !(blob instanceof Blob)) {
    throw new Error("HEIC/HEIF gagal dikonversi ke JPEG sementara.");
  }

  const outputName = stripExtension(file.name || "heic-input") + ".jpg";

  return new File([blob], outputName, {
    type: "image/jpeg",
    lastModified: Date.now()
  });
}

async function loadHeic2Any() {
  if (window.heic2any) {
    return window.heic2any;
  }

  if (!heicLoaderPromise) {
    heicLoaderPromise = loadScript(LOCAL_HEIC2ANY_URL)
      .catch(() => loadScript(CDN_HEIC2ANY_URL))
      .then(() => {
        if (!window.heic2any) {
          throw new Error("Library HEIC decoder belum tersedia.");
        }

        return window.heic2any;
      })
      .catch(() => {
        heicLoaderPromise = null;
        throw new Error(
          "HEIC/HEIF membutuhkan decoder tambahan heic2any. Pastikan internet aktif saat pertama kali memakai HEIC, atau simpan heic2any.min.js di folder vendor."
        );
      });
  }

  return heicLoaderPromise;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-heic2any="${src}"]`);

    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.dataset.heic2any = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Gagal memuat ${src}`));

    document.head.appendChild(script);
  });
}

function stripExtension(filename) {
  return String(filename || "")
    .replace(/\.[a-z0-9]+$/i, "");
}
