import {
  getOutputExtension,
  isSupportedImage,
  processImageFile,
  readImageMeta
} from "./imageProcessor.js";

import {
  copyText,
  downloadBlob,
  sanitizeFileBaseName,
  stripExtension
} from "./downloadHelper.js";

import {
  buildImgSnippet,
  formatBytes,
  renderReport
} from "./reportHelper.js";

const APP_VERSION = "1.0.0";

const PRESETS = {
  custom: null,
  activity: {
    width: 1200,
    quality: 80,
    mimeType: "image/webp",
    suffix: "kegiatan-1200"
  },
  thumb: {
    width: 480,
    quality: 75,
    mimeType: "image/webp",
    suffix: "kegiatan-thumb-480"
  },
  profile: {
    width: 512,
    quality: 80,
    mimeType: "image/webp",
    suffix: "profile-512"
  },
  hero: {
    width: 1200,
    quality: 80,
    mimeType: "image/webp",
    suffix: "hero-1200"
  },
  screenshot: {
    width: 1200,
    quality: 85,
    mimeType: "image/webp",
    suffix: "screenshot-1200"
  }
};

const state = {
  file: null,
  originalMeta: null,
  originalObjectUrl: null,
  outputBlob: null,
  outputObjectUrl: null,
  outputName: "",
  snippet: ""
};

const els = {
  fileInput: document.querySelector("#fileInput"),
  dropZone: document.querySelector("#dropZone"),
  fileInfo: document.querySelector("#fileInfo"),
  presetSelect: document.querySelector("#presetSelect"),
  outputNameInput: document.querySelector("#outputNameInput"),
  widthInput: document.querySelector("#widthInput"),
  formatSelect: document.querySelector("#formatSelect"),
  qualityInput: document.querySelector("#qualityInput"),
  qualityOutput: document.querySelector("#qualityOutput"),
  altInput: document.querySelector("#altInput"),
  preventUpscaleInput: document.querySelector("#preventUpscaleInput"),
  processBtn: document.querySelector("#processBtn"),
  downloadBtn: document.querySelector("#downloadBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  copySnippetBtn: document.querySelector("#copySnippetBtn"),
  originalPreview: document.querySelector("#originalPreview"),
  outputPreview: document.querySelector("#outputPreview"),
  originalEmpty: document.querySelector("#originalEmpty"),
  outputEmpty: document.querySelector("#outputEmpty"),
  reportBox: document.querySelector("#reportBox"),
  snippetOutput: document.querySelector("#snippetOutput"),
  toast: document.querySelector("#toast")
};

boot();

function boot() {
  bindEvents();
  registerServiceWorker();
  updateQualityLabel();

  console.info(`Web Asset Prep Tool v${APP_VERSION} aktif`);
}

function bindEvents() {
  els.fileInput.addEventListener("change", () => {
    const [file] = els.fileInput.files || [];
    if (file) handleFile(file);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    els.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.dropZone.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    els.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.dropZone.classList.remove("is-dragging");
    });
  });

  els.dropZone.addEventListener("drop", (event) => {
    const [file] = event.dataTransfer?.files || [];
    if (file) handleFile(file);
  });

  els.presetSelect.addEventListener("change", applyPreset);
  els.qualityInput.addEventListener("input", updateQualityLabel);
  els.processBtn.addEventListener("click", processCurrentFile);
  els.downloadBtn.addEventListener("click", downloadCurrentOutput);
  els.copySnippetBtn.addEventListener("click", copyCurrentSnippet);
  els.resetBtn.addEventListener("click", resetApp);

  els.formatSelect.addEventListener("change", () => {
    if (state.file && !els.outputNameInput.value.trim()) {
      suggestOutputName();
    }
  });

  els.widthInput.addEventListener("input", () => {
    if (state.file && !els.outputNameInput.value.trim()) {
      suggestOutputName();
    }
  });
}

async function handleFile(file) {
  clearOutputOnly();

  if (!isSupportedImage(file)) {
    showToast("Format belum didukung. Gunakan JPG, PNG, atau WebP.");
    return;
  }

  try {
    releaseObjectUrl("originalObjectUrl");
    state.file = file;
    state.originalMeta = await readImageMeta(file);
    state.originalObjectUrl = state.originalMeta.objectUrl;

    els.originalPreview.src = state.originalObjectUrl;
    els.originalPreview.parentElement.classList.add("has-image");

    els.fileInfo.classList.remove("empty");
    els.fileInfo.innerHTML = `
      <strong>${escapeHtml(file.name)}</strong><br>
      ${escapeHtml(file.type)} · ${formatBytes(file.size)} ·
      ${state.originalMeta.width} × ${state.originalMeta.height}px
    `;

    suggestOutputName();

    if (!Number(els.widthInput.value)) {
      els.widthInput.value = Math.min(1200, state.originalMeta.width);
    }

    els.processBtn.disabled = false;
    showToast("Gambar berhasil dibaca.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Gagal membaca gambar.");
    resetApp();
  }
}

function applyPreset() {
  const preset = PRESETS[els.presetSelect.value];
  if (!preset) return;

  els.widthInput.value = preset.width;
  els.qualityInput.value = preset.quality;
  els.formatSelect.value = preset.mimeType;
  updateQualityLabel();

  if (state.file) {
    const base = sanitizeFileBaseName(stripExtension(state.file.name));
    els.outputNameInput.value = `${base}-${preset.suffix}`;
  }
}

function suggestOutputName() {
  if (!state.file) return;

  const base = sanitizeFileBaseName(stripExtension(state.file.name));
  const width = Number(els.widthInput.value) || 1200;
  const ext = getOutputExtension(els.formatSelect.value);

  els.outputNameInput.placeholder = `${base}-${width}.${ext}`;
}

async function processCurrentFile() {
  if (!state.file) {
    showToast("Pilih file terlebih dahulu.");
    return;
  }

  els.processBtn.disabled = true;
  els.processBtn.textContent = "Memproses...";

  try {
    const mimeType = els.formatSelect.value;
    const ext = getOutputExtension(mimeType);
    const baseName = sanitizeFileBaseName(
      els.outputNameInput.value.trim() || `${stripExtension(state.file.name)}-${els.widthInput.value}`
    );
    const outputName = `${baseName}.${ext}`;

    const result = await processImageFile(state.file, {
      width: Number(els.widthInput.value),
      quality: Number(els.qualityInput.value),
      mimeType,
      preventUpscale: els.preventUpscaleInput.checked
    });

    releaseObjectUrl("outputObjectUrl");

    state.outputBlob = result.blob;
    state.outputObjectUrl = URL.createObjectURL(result.blob);
    state.outputName = outputName;
    state.snippet = buildImgSnippet({
      filename: outputName,
      alt: els.altInput.value,
      width: result.outputMeta.width,
      height: result.outputMeta.height
    });

    els.outputPreview.src = state.outputObjectUrl;
    els.outputPreview.parentElement.classList.add("has-image");

    els.reportBox.classList.remove("empty");
    els.reportBox.innerHTML = renderReport({
      originalName: state.file.name,
      outputName,
      originalType: result.sourceMeta.type,
      outputType: result.outputMeta.type,
      originalSize: result.sourceMeta.size,
      outputSize: result.outputMeta.size,
      originalWidth: result.sourceMeta.width,
      originalHeight: result.sourceMeta.height,
      outputWidth: result.outputMeta.width,
      outputHeight: result.outputMeta.height
    });

    els.snippetOutput.textContent = state.snippet;
    els.downloadBtn.disabled = false;
    els.copySnippetBtn.disabled = false;

    showToast(`Selesai: ${outputName}`);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Gagal memproses gambar.");
  } finally {
    els.processBtn.disabled = false;
    els.processBtn.textContent = "Proses gambar";
  }
}

function downloadCurrentOutput() {
  if (!state.outputBlob || !state.outputName) {
    showToast("Belum ada output untuk didownload.");
    return;
  }

  downloadBlob(state.outputBlob, state.outputName);
  showToast("Download dimulai.");
}

async function copyCurrentSnippet() {
  if (!state.snippet) {
    showToast("Snippet belum tersedia.");
    return;
  }

  await copyText(state.snippet);
  showToast("Snippet berhasil disalin.");
}

function updateQualityLabel() {
  els.qualityOutput.value = els.qualityInput.value;
  els.qualityOutput.textContent = els.qualityInput.value;
}

function clearOutputOnly() {
  releaseObjectUrl("outputObjectUrl");

  state.outputBlob = null;
  state.outputObjectUrl = null;
  state.outputName = "";
  state.snippet = "";

  els.outputPreview.removeAttribute("src");
  els.outputPreview.parentElement.classList.remove("has-image");
  els.reportBox.className = "report-box empty";
  els.reportBox.textContent = "Laporan belum tersedia.";
  els.snippetOutput.textContent = "<!-- Snippet akan muncul setelah gambar diproses -->";
  els.downloadBtn.disabled = true;
  els.copySnippetBtn.disabled = true;
}

function resetApp() {
  releaseObjectUrl("originalObjectUrl");
  clearOutputOnly();

  state.file = null;
  state.originalMeta = null;
  state.originalObjectUrl = null;

  els.fileInput.value = "";
  els.fileInfo.className = "file-info empty";
  els.fileInfo.textContent = "Belum ada file dipilih.";
  els.originalPreview.removeAttribute("src");
  els.originalPreview.parentElement.classList.remove("has-image");
  els.processBtn.disabled = true;
  els.outputNameInput.value = "";
  els.altInput.value = "";
  els.presetSelect.value = "custom";
  els.widthInput.value = 1200;
  els.formatSelect.value = "image/webp";
  els.qualityInput.value = 80;
  els.preventUpscaleInput.checked = true;
  updateQualityLabel();
}

function releaseObjectUrl(key) {
  if (state[key]) {
    URL.revokeObjectURL(state[key]);
    state[key] = null;
  }
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");

  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 2800);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("Service worker gagal didaftarkan:", error);
    });
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
