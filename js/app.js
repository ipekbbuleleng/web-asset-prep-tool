import {
  getOutputExtension,
  isSupportedImage,
  processImageFile,
  readImageMeta
} from "./imageProcessor.js";

import {
  copyText,
  downloadBlob,
  downloadMany,
  sanitizeFileBaseName,
  stripExtension
} from "./downloadHelper.js";

import {
  buildImgSnippet,
  buildPictureSnippet,
  formatBytes,
  renderResponsiveReport,
  renderSingleReport
} from "./reportHelper.js";

import {
  convertHeicToJpegFile,
  getReadableMimeLabel,
  isHeicFile
} from "./heicAdapter.js";

const APP_VERSION = "1.0.2-r2-r1";

const PRESETS = {
  custom: null,
  activity: {
    width: 1200,
    quality: 80,
    mimeType: "image/webp",
    suffix: "kegiatan-1200",
    responsiveMode: false
  },
  thumb: {
    width: 480,
    quality: 75,
    mimeType: "image/webp",
    suffix: "kegiatan-thumb-480",
    responsiveMode: false
  },
  profile: {
    width: 512,
    quality: 80,
    mimeType: "image/webp",
    suffix: "profile-512",
    responsiveMode: false
  },
  hero: {
    width: 1200,
    quality: 80,
    mimeType: "image/webp",
    suffix: "hero",
    responsiveMode: true,
    widths: "480, 800, 1200, 1600",
    sizes: "(max-width: 600px) 480px, (max-width: 1024px) 800px, 1200px"
  },
  screenshot: {
    width: 1200,
    quality: 85,
    mimeType: "image/webp",
    suffix: "screenshot-1200",
    responsiveMode: false
  }
};

const state = {
  file: null,
  processableFile: null,
  isHeicInput: false,
  heicNotice: "",
  originalMeta: null,
  originalObjectUrl: null,
  outputBlob: null,
  outputObjectUrl: null,
  outputName: "",
  responsiveOutputs: [],
  snippet: "",
  outputNameTouched: false
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
  responsiveModeInput: document.querySelector("#responsiveModeInput"),
  responsiveWidthsInput: document.querySelector("#responsiveWidthsInput"),
  sizesInput: document.querySelector("#sizesInput"),
  processBtn: document.querySelector("#processBtn"),
  downloadBtn: document.querySelector("#downloadBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  copySnippetBtn: document.querySelector("#copySnippetBtn"),
  originalPreview: document.querySelector("#originalPreview"),
  outputPreview: document.querySelector("#outputPreview"),
  outputPreviewLabel: document.querySelector("#outputPreviewLabel"),
  reportBox: document.querySelector("#reportBox"),
  snippetOutput: document.querySelector("#snippetOutput"),
  toast: document.querySelector("#toast")
};

boot();

function boot() {
  bindEvents();
  registerServiceWorker();
  updateQualityLabel();
  syncResponsiveControls();
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

  els.presetSelect.addEventListener("change", () => {
    state.outputNameTouched = false;
    applyPreset();
  });

  els.qualityInput.addEventListener("input", updateQualityLabel);
  els.processBtn.addEventListener("click", processCurrentFile);
  els.downloadBtn.addEventListener("click", downloadCurrentOutput);
  els.copySnippetBtn.addEventListener("click", copyCurrentSnippet);
  els.resetBtn.addEventListener("click", resetApp);

  els.responsiveModeInput.addEventListener("change", () => {
    state.outputNameTouched = false;
    syncResponsiveControls();
    updateOutputNameSuggestion(true);
  });

  [els.widthInput, els.responsiveWidthsInput].forEach((element) => {
    element.addEventListener("input", () => {
      if (!state.outputNameTouched) {
        updateOutputNameSuggestion(false);
      }
    });
  });

  els.outputNameInput.addEventListener("input", () => {
    state.outputNameTouched = !!els.outputNameInput.value.trim();
  });
}

async function handleFile(file) {
  clearOutputOnly();

  const isHeic = isHeicFile(file);

  if (!isHeic && !isSupportedImage(file)) {
    showToast("Format belum didukung. Gunakan JPG, PNG, WebP, HEIC, atau HEIF.");
    return;
  }

  try {
    releaseObjectUrl("originalObjectUrl");
    state.file = file;
    state.processableFile = file;
    state.isHeicInput = isHeic;
    state.heicNotice = "";
    state.outputNameTouched = false;

    if (isHeic) {
      showToast("Membaca HEIC/HEIF. Proses awal bisa lebih lama...");
      state.processableFile = await convertHeicToJpegFile(file, { quality: 0.92 });
      state.heicNotice = "HEIC/HEIF dikonversi dulu ke JPEG sementara di browser, lalu diproses menjadi output yang dipilih.";
    }

    state.originalMeta = await readImageMeta(state.processableFile);
    state.originalObjectUrl = state.originalMeta.objectUrl;

    els.originalPreview.src = state.originalObjectUrl;
    els.originalPreview.parentElement.classList.add("has-image");

    const heicBadge = isHeic
      ? `<br><small><strong>Catatan:</strong> ${escapeHtml(state.heicNotice)}</small>`
      : "";

    els.fileInfo.classList.remove("empty");
    els.fileInfo.innerHTML = `
      <strong>${escapeHtml(file.name)}</strong><br>
      ${escapeHtml(getReadableMimeLabel(file))} · ${formatBytes(file.size)} ·
      ${state.originalMeta.width} × ${state.originalMeta.height}px
      ${heicBadge}
    `;

    updateOutputNameSuggestion(true);

    if (!Number(els.widthInput.value)) {
      els.widthInput.value = Math.min(1200, state.originalMeta.width);
    }

    els.processBtn.disabled = false;
    showToast(isHeic ? "HEIC/HEIF berhasil dibaca." : "Gambar berhasil dibaca.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Gagal membaca gambar.");
    resetApp();
  }
}

function applyPreset() {
  const preset = PRESETS[els.presetSelect.value];
  if (!preset) {
    updateOutputNameSuggestion(true);
    return;
  }

  els.widthInput.value = preset.width;
  els.qualityInput.value = preset.quality;
  els.formatSelect.value = preset.mimeType;
  els.responsiveModeInput.checked = !!preset.responsiveMode;

  if (preset.widths) {
    els.responsiveWidthsInput.value = preset.widths;
  }

  if (preset.sizes) {
    els.sizesInput.value = preset.sizes;
  }

  updateQualityLabel();
  syncResponsiveControls();
  updateOutputNameSuggestion(true);
}

function syncResponsiveControls() {
  const isResponsive = els.responsiveModeInput.checked;
  els.responsiveWidthsInput.disabled = !isResponsive;
  els.sizesInput.disabled = !isResponsive;
  els.widthInput.disabled = isResponsive;
}

function getCurrentPreset() {
  return PRESETS[els.presetSelect.value] || null;
}

function computeSuggestedBaseName() {
  const fileBase = sanitizeFileBaseName(stripExtension(state.file?.name || "asset"));
  const preset = getCurrentPreset();

  if (preset?.suffix) {
    return `${fileBase}-${preset.suffix}`;
  }

  if (els.responsiveModeInput.checked) {
    return `${fileBase}-responsive`;
  }

  const width = Number(els.widthInput.value) || 1200;
  return `${fileBase}-${width}`;
}

function updateOutputNameSuggestion(force = false) {
  const suggestion = computeSuggestedBaseName();
  els.outputNameInput.placeholder = suggestion;

  if (force || !els.outputNameInput.value.trim() || !state.outputNameTouched) {
    els.outputNameInput.value = suggestion;
  }
}

async function processCurrentFile() {
  if (!state.file) {
    showToast("Pilih file terlebih dahulu.");
    return;
  }

  els.processBtn.disabled = true;
  els.processBtn.textContent = "Memproses...";

  try {
    const processingSource = state.processableFile || state.file;
    const mimeType = els.formatSelect.value;
    const ext = getOutputExtension(mimeType);
    const responsiveMode = els.responsiveModeInput.checked;
    const baseName = sanitizeFileBaseName(
      els.outputNameInput.value.trim() || computeSuggestedBaseName()
    );

    if (responsiveMode) {
      const widths = parseWidths(els.responsiveWidthsInput.value);

      if (widths.length === 0) {
        throw new Error("Isi daftar width responsive terlebih dahulu.");
      }

      const outputs = [];

      for (const width of widths) {
        const result = await processImageFile(processingSource, {
          width,
          quality: Number(els.qualityInput.value),
          mimeType,
          preventUpscale: els.preventUpscaleInput.checked
        });

        const outputWidth = result.outputMeta.width;
        const filename = `${baseName}-${outputWidth}.${ext}`;
        const objectUrl = URL.createObjectURL(result.blob);

        outputs.push({
          blob: result.blob,
          name: filename,
          width: result.outputMeta.width,
          height: result.outputMeta.height,
          size: result.outputMeta.size,
          type: result.outputMeta.type,
          objectUrl
        });
      }

      clearOutputOnly();
      state.responsiveOutputs = outputs;

      const previewVariant = [...outputs].sort((a, b) => b.width - a.width)[0];
      els.outputPreview.src = previewVariant.objectUrl;
      els.outputPreview.parentElement.classList.add("has-image");
      els.outputPreviewLabel.textContent = `Preview varian terbesar: ${previewVariant.width} × ${previewVariant.height}px`;

      state.snippet = buildPictureSnippet({
        outputs,
        alt: els.altInput.value,
        sizes: els.sizesInput.value,
        mimeType
      });

      els.reportBox.classList.remove("empty");
      els.reportBox.innerHTML = renderResponsiveReport({
        originalName: state.file.name,
        originalType: getReadableMimeLabel(state.file),
        originalSize: state.file.size,
        originalWidth: state.originalMeta.width,
        originalHeight: state.originalMeta.height,
        outputType: mimeType,
        widthsText: widths.join(", "),
        outputs
      });

      els.snippetOutput.textContent = state.snippet;
      els.downloadBtn.disabled = false;
      els.copySnippetBtn.disabled = false;
      showToast(`Selesai: ${outputs.length} varian responsive dibuat.`);
      return;
    }

    const result = await processImageFile(processingSource, {
      width: Number(els.widthInput.value),
      quality: Number(els.qualityInput.value),
      mimeType,
      preventUpscale: els.preventUpscaleInput.checked
    });

    clearOutputOnly();

    const outputName = `${baseName}.${ext}`;
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
    els.outputPreviewLabel.textContent = `Preview output: ${result.outputMeta.width} × ${result.outputMeta.height}px`;

    els.reportBox.classList.remove("empty");
    els.reportBox.innerHTML = renderSingleReport({
      originalName: state.file.name,
      outputName,
      originalType: getReadableMimeLabel(state.file),
      outputType: result.outputMeta.type,
      originalSize: state.file.size,
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
  if (state.responsiveOutputs.length > 0) {
    downloadMany(state.responsiveOutputs);
    showToast("Mengunduh semua varian responsive...");
    return;
  }

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

  if (state.responsiveOutputs.length > 0) {
    state.responsiveOutputs.forEach((item) => {
      if (item.objectUrl) URL.revokeObjectURL(item.objectUrl);
    });
  }

  state.outputBlob = null;
  state.outputObjectUrl = null;
  state.outputName = "";
  state.responsiveOutputs = [];
  state.snippet = "";

  els.outputPreview.removeAttribute("src");
  els.outputPreview.parentElement.classList.remove("has-image");
  els.outputPreviewLabel.textContent = "Hasil akan tampil setelah diproses.";
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
  state.processableFile = null;
  state.isHeicInput = false;
  state.heicNotice = "";
  state.originalMeta = null;
  state.outputNameTouched = false;

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
  els.responsiveModeInput.checked = false;
  els.responsiveWidthsInput.value = "480, 800, 1200";
  els.sizesInput.value = "(max-width: 600px) 480px, (max-width: 1024px) 800px, 1200px";
  syncResponsiveControls();
  updateQualityLabel();
}

function parseWidths(value) {
  const unique = Array.from(new Set(
    String(value || "")
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item) && item >= 64 && item <= 5000)
      .map((item) => Math.round(item))
  ));

  return unique.sort((a, b) => a - b).slice(0, 8);
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
