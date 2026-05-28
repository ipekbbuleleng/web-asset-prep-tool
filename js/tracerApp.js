import {
  copyText,
  downloadBlob,
  sanitizeFileBaseName,
  stripExtension
} from "./downloadHelper.js";

import {
  formatBytes
} from "./reportHelper.js";

import {
  convertHeicToJpegFile,
  isHeicFile
} from "./heicAdapter.js";

import {
  traceRasterToSvg,
  svgTextToObjectUrl
} from "./rasterTracer.js";

const APP_VERSION = "1.0.6-r5-final-image-vector";

const TRACER_PRESETS = {
  icon: {
    label: "Ikon sederhana",
    traceWidth: 192,
    threshold: 128,
    fillColor: "#111827",
    invert: false,
    transparent: true,
    note: "Untuk ikon satu warna atau simbol sangat sederhana."
  },
  logo: {
    label: "Logo sederhana",
    traceWidth: 256,
    threshold: 128,
    fillColor: "#111827",
    invert: false,
    transparent: true,
    note: "Preset seimbang untuk logo sederhana."
  },
  flat: {
    label: "Ilustrasi flat",
    traceWidth: 384,
    threshold: 140,
    fillColor: "#111827",
    invert: false,
    transparent: true,
    note: "Untuk ilustrasi flat dengan detail sedang."
  },
  detail: {
    label: "Detail tinggi",
    traceWidth: 512,
    threshold: 128,
    fillColor: "#111827",
    invert: false,
    transparent: true,
    note: "Lebih detail, tetapi output SVG bisa membesar."
  }
};

const state = {
  file: null,
  processableFile: null,
  originalUrl: "",
  outputUrl: "",
  outputBlob: null,
  outputName: "",
  snippet: "",
  sourceMeta: null,
  outputMeta: null,
  currentPreset: "logo"
};

const els = {
  fileInput: document.querySelector("#tracerFileInput"),
  dropZone: document.querySelector("#tracerDropZone"),
  fileInfo: document.querySelector("#tracerFileInfo"),
  presetSelect: document.querySelector("#tracerPresetSelect"),
  outputNameInput: document.querySelector("#outputNameInput"),
  traceWidthInput: document.querySelector("#traceWidthInput"),
  traceWidthOutput: document.querySelector("#traceWidthOutput"),
  thresholdInput: document.querySelector("#thresholdInput"),
  thresholdOutput: document.querySelector("#thresholdOutput"),
  fillColorInput: document.querySelector("#fillColorInput"),
  invertInput: document.querySelector("#invertInput"),
  transparentInput: document.querySelector("#transparentInput"),
  safetyBox: document.querySelector("#tracerSafetyBox"),
  traceBtn: document.querySelector("#traceBtn"),
  safePresetBtn: document.querySelector("#safePresetBtn"),
  downloadBtn: document.querySelector("#downloadSvgBtn"),
  copyBtn: document.querySelector("#copySnippetBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  progressText: document.querySelector("#progressText"),
  originalPreview: document.querySelector("#originalPreview"),
  outputPreview: document.querySelector("#outputPreview"),
  originalLabel: document.querySelector("#originalLabel"),
  outputLabel: document.querySelector("#outputLabel"),
  reportBox: document.querySelector("#reportBox"),
  snippetOutput: document.querySelector("#snippetOutput"),
  toast: document.querySelector("#toast")
};

boot();

function boot() {
  bindEvents();
  applyPreset("logo");
  updateThresholdLabel();
  updateTraceWidthLabel();
  updateSafetyHint();
  registerServiceWorker();
  console.info(`Raster Tracer v${APP_VERSION} aktif`);
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
    applyPreset(els.presetSelect.value);
  });

  els.thresholdInput.addEventListener("input", () => {
    markCustomPreset();
    updateThresholdLabel();
    updateSafetyHint();
  });

  els.traceWidthInput.addEventListener("input", () => {
    markCustomPreset();
    updateTraceWidthLabel();
    updateSafetyHint();
  });

  [els.fillColorInput, els.invertInput, els.transparentInput].forEach((element) => {
    element.addEventListener("input", () => {
      markCustomPreset();
      updateSafetyHint();
    });
    element.addEventListener("change", () => {
      markCustomPreset();
      updateSafetyHint();
    });
  });

  els.safePresetBtn.addEventListener("click", () => {
    applyPreset("logo");
    showToast("Setting aman diterapkan.");
  });

  els.traceBtn.addEventListener("click", traceCurrentFile);
  els.downloadBtn.addEventListener("click", downloadCurrentSvg);
  els.copyBtn.addEventListener("click", copyCurrentSnippet);
  els.resetBtn.addEventListener("click", resetApp);
}

function applyPreset(key) {
  if (key === "custom") {
    state.currentPreset = "custom";
    els.presetSelect.value = "custom";
    updateSafetyHint();
    return;
  }

  const preset = TRACER_PRESETS[key] || TRACER_PRESETS.logo;
  state.currentPreset = key;
  els.presetSelect.value = key;
  els.traceWidthInput.value = preset.traceWidth;
  els.thresholdInput.value = preset.threshold;
  els.fillColorInput.value = preset.fillColor;
  els.invertInput.checked = preset.invert;
  els.transparentInput.checked = preset.transparent;

  updateThresholdLabel();
  updateTraceWidthLabel();
  updateSafetyHint();
}

function markCustomPreset() {
  if (state.currentPreset !== "custom") {
    state.currentPreset = "custom";
    els.presetSelect.value = "custom";
  }
}

async function handleFile(file) {
  resetOutputOnly();

  if (!isSupportedRaster(file) && !isHeicFile(file)) {
    showToast("Format belum didukung. Gunakan JPG, PNG, WebP, HEIC, atau HEIF.");
    return;
  }

  try {
    state.file = file;
    state.processableFile = file;

    els.progressText.textContent = "Membaca file...";

    if (isHeicFile(file)) {
      showToast("Membaca HEIC/HEIF untuk tracing...");
      state.processableFile = await convertHeicToJpegFile(file, { quality: 0.92 });
    }

    releaseUrl("originalUrl");
    state.originalUrl = URL.createObjectURL(state.processableFile);
    const meta = await readImageDimensions(state.originalUrl);
    state.sourceMeta = meta;

    els.originalPreview.src = state.originalUrl;
    els.originalPreview.parentElement.classList.add("has-image");
    els.originalLabel.textContent = `${file.name} · ${meta.width} × ${meta.height}px`;

    els.fileInfo.classList.remove("empty");
    els.fileInfo.innerHTML = `
      <strong>${escapeHtml(file.name)}</strong><br>
      ${escapeHtml(file.type || "unknown")} · ${formatBytes(file.size)} · ${meta.width} × ${meta.height}px
      ${isHeicFile(file) ? "<br><small><strong>Catatan:</strong> HEIC/HEIF dikonversi dulu ke JPEG sementara di browser.</small>" : ""}
    `;

    const suggestedName = `${sanitizeFileBaseName(stripExtension(file.name))}-traced`;
    els.outputNameInput.value = suggestedName;

    els.traceBtn.disabled = false;
    els.progressText.textContent = "File siap ditrace.";
    updateSafetyHint();
    showToast("File berhasil dibaca.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Gagal membaca file.");
    resetApp();
  }
}

async function traceCurrentFile() {
  if (!state.processableFile) {
    showToast("Pilih file terlebih dahulu.");
    return;
  }

  els.traceBtn.disabled = true;
  els.downloadBtn.disabled = true;
  els.copyBtn.disabled = true;
  els.traceBtn.textContent = "Tracing...";
  els.progressText.textContent = "Membuat SVG path...";

  try {
    const baseName = sanitizeFileBaseName(els.outputNameInput.value || `${stripExtension(state.file.name)}-traced`);
    const result = await traceRasterToSvg(state.processableFile, {
      traceWidth: Number(els.traceWidthInput.value),
      threshold: Number(els.thresholdInput.value),
      fillColor: els.fillColorInput.value,
      invert: els.invertInput.checked,
      transparentBackground: els.transparentInput.checked,
      title: baseName
    });

    resetOutputOnly();

    state.outputBlob = result.blob;
    state.outputName = `${baseName}.svg`;
    state.outputMeta = result.meta;
    state.outputUrl = svgTextToObjectUrl(result.svg);
    state.snippet = buildSnippet(state.outputName, result.meta);

    els.outputPreview.src = state.outputUrl;
    els.outputPreview.parentElement.classList.add("has-image");
    els.outputLabel.textContent = `${state.outputName} · ${result.meta.width} × ${result.meta.height}`;

    const recommendation = getRecommendation(result.meta, result.blob.size);
    updateSafetyBox(recommendation);

    els.reportBox.classList.remove("empty");
    els.reportBox.innerHTML = renderReport(result.meta, state.outputName, result.blob.size, recommendation);

    els.snippetOutput.textContent = state.snippet;
    els.downloadBtn.disabled = false;
    els.copyBtn.disabled = false;
    els.progressText.textContent = `Selesai: ${state.outputName}`;
    showToast("SVG path berhasil dibuat.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Gagal tracing gambar.");
  } finally {
    els.traceBtn.disabled = false;
    els.traceBtn.textContent = "Trace ke SVG";
  }
}

function renderReport(meta, outputName, outputSize, recommendation) {
  const originalSize = state.file?.size || 0;
  const saving = originalSize && outputSize
    ? Math.max(0, (1 - outputSize / originalSize) * 100)
    : 0;

  const ratio = originalSize ? outputSize / originalSize : 0;

  return `
    <table class="report-table">
      <tbody>
        <tr><th scope="row">Preset</th><td>${escapeHtml(getPresetLabel())}</td></tr>
        <tr><th scope="row">Nama file asli</th><td>${escapeHtml(state.file.name)}</td></tr>
        <tr><th scope="row">Dimensi asli</th><td>${meta.sourceWidth} × ${meta.sourceHeight}px</td></tr>
        <tr><th scope="row">Ukuran asli</th><td>${formatBytes(originalSize)}</td></tr>
        <tr><th scope="row">Nama output</th><td>${escapeHtml(outputName)}</td></tr>
        <tr><th scope="row">Dimensi SVG</th><td>${meta.width} × ${meta.height} viewBox</td></tr>
        <tr><th scope="row">Ukuran SVG</th><td>${formatBytes(outputSize)}</td></tr>
        <tr><th scope="row">Rasio SVG vs file asli</th><td>${(ratio * 100).toFixed(1)}%</td></tr>
        <tr><th scope="row">Path segment</th><td>${meta.runCount}</td></tr>
        <tr><th scope="row">Pixel aktif</th><td>${meta.activePixelCount} (${(meta.activeRatio * 100).toFixed(1)}%)</td></tr>
        <tr><th scope="row">Estimasi variasi warna</th><td>${meta.colorBucketCount} bucket</td></tr>
        <tr><th scope="row">Penghematan vs file asli</th><td>${saving.toFixed(1)}%</td></tr>
        <tr><th scope="row">Safety guard</th><td>${renderSafetyList(recommendation)}</td></tr>
        <tr><th scope="row">Status rekomendasi</th><td><span class="status-pill ${recommendation.className}">${recommendation.label}</span><br><small>${recommendation.note}</small></td></tr>
      </tbody>
    </table>
    <div class="note-box">
      ${escapeHtml(recommendation.nextAction)}
    </div>
  `;
}

function getRecommendation(meta, outputSize) {
  const originalSize = state.file?.size || 0;
  const ratio = originalSize ? outputSize / originalSize : 1;
  const issues = [];

  if (meta.runCount > 8000) issues.push("Path segment sangat banyak.");
  else if (meta.runCount > 3500) issues.push("Path segment cukup banyak.");

  if (meta.colorBucketCount > 180) issues.push("Gambar tampak memiliki banyak variasi warna.");
  else if (meta.colorBucketCount > 80) issues.push("Variasi warna sedang; cek visual hasil.");

  if (ratio > 1) issues.push("SVG lebih besar dari file asli.");
  else if (ratio > 0.75) issues.push("Ukuran SVG belum jauh lebih ringan.");

  if (meta.activeRatio > 0.72) issues.push("Area aktif sangat padat; SVG bisa berat dirender.");

  if (meta.runCount <= 2500 && outputSize <= 180 * 1024 && meta.colorBucketCount <= 80 && ratio <= 0.75) {
    return {
      label: "Cocok untuk SVG",
      className: "status-ready",
      note: "Output relatif ringan dan kompleksitas masih aman.",
      issues,
      nextAction: "Hasil layak digunakan sebagai SVG eksternal. Tetap cek visual sebelum masuk repository."
    };
  }

  if (meta.runCount <= 8000 && outputSize <= 512 * 1024 && ratio <= 1 && meta.colorBucketCount <= 180) {
    return {
      label: "Perlu cek visual",
      className: "status-check",
      note: "Masih bisa dipakai, tetapi perlu cek ukuran, detail visual, dan rendering di HP.",
      issues,
      nextAction: "Coba bandingkan dengan WebP dari Image Tool. Jika SVG terlihat baik dan ukurannya lebih kecil, boleh dipakai."
    };
  }

  return {
    label: "Tidak disarankan",
    className: "status-risk",
    note: "Gambar terlalu kompleks untuk SVG path ringan.",
    issues,
    nextAction: "Gunakan Image Tool untuk output WebP/JPG/PNG, atau turunkan lebar tracing dan naik/turunkan threshold."
  };
}

function renderSafetyList(recommendation) {
  if (!recommendation.issues.length) {
    return `<span class="status-pill status-ready">Tidak ada isu utama</span>`;
  }

  return `
    <ul class="safety-issue-list">
      ${recommendation.issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")}
    </ul>
  `;
}

function updateSafetyHint() {
  const presetLabel = getPresetLabel();
  const width = Number(els.traceWidthInput.value);
  let level = "Aman";
  let className = "status-ready";
  let note = "Cocok untuk uji awal logo/ikon sederhana.";

  if (width >= 512) {
    level = "Perlu cek visual";
    className = "status-check";
    note = "Lebar tracing cukup tinggi. Hasil lebih detail, tetapi SVG bisa membesar.";
  }

  if (width >= 768) {
    level = "Berisiko berat";
    className = "status-risk";
    note = "Lebar tracing tinggi. Gunakan hanya untuk uji detail, bukan default produksi.";
  }

  els.safetyBox.innerHTML = `
    <strong>Safety guard:</strong>
    <span class="status-pill ${className}">${level}</span>
    Preset: ${escapeHtml(presetLabel)}. ${escapeHtml(note)}
  `;
}

function updateSafetyBox(recommendation) {
  els.safetyBox.innerHTML = `
    <strong>Safety guard:</strong>
    <span class="status-pill ${recommendation.className}">${recommendation.label}</span>
    ${escapeHtml(recommendation.note)}
  `;
}

function getPresetLabel() {
  if (state.currentPreset === "custom") return "Custom/manual";
  return TRACER_PRESETS[state.currentPreset]?.label || "Logo sederhana";
}

function buildSnippet(filename, meta) {
  return `<img src="./assets/images/${escapeHtml(filename)}" alt="${escapeHtml(stripExtension(filename).replace(/[-_]+/g, " "))}" width="${meta.width}" height="${meta.height}" loading="lazy" decoding="async">`;
}

function downloadCurrentSvg() {
  if (!state.outputBlob || !state.outputName) {
    showToast("Belum ada SVG untuk didownload.");
    return;
  }

  downloadBlob(state.outputBlob, state.outputName);
  showToast("Download SVG dimulai.");
}

async function copyCurrentSnippet() {
  if (!state.snippet) {
    showToast("Snippet belum tersedia.");
    return;
  }

  await copyText(state.snippet);
  showToast("Snippet berhasil disalin.");
}

function isSupportedRaster(file) {
  const type = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();

  return (
    ["image/jpeg", "image/png", "image/webp"].includes(type) ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp")
  );
}

function readImageDimensions(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Gambar tidak dapat dibaca."));
    img.src = url;
  });
}

function resetOutputOnly() {
  releaseUrl("outputUrl");
  state.outputBlob = null;
  state.outputName = "";
  state.outputMeta = null;
  state.snippet = "";

  els.outputPreview.removeAttribute("src");
  els.outputPreview.parentElement.classList.remove("has-image");
  els.outputLabel.textContent = "Hasil akan tampil setelah tracing.";
  els.reportBox.className = "report-box empty";
  els.reportBox.textContent = "Laporan belum tersedia.";
  els.snippetOutput.textContent = "<!-- Snippet akan muncul setelah tracing -->";
  els.downloadBtn.disabled = true;
  els.copyBtn.disabled = true;
}

function resetApp() {
  resetOutputOnly();
  releaseUrl("originalUrl");

  state.file = null;
  state.processableFile = null;
  state.sourceMeta = null;

  els.fileInput.value = "";
  els.fileInfo.className = "file-info empty";
  els.fileInfo.textContent = "Belum ada file dipilih.";
  els.originalPreview.removeAttribute("src");
  els.originalPreview.parentElement.classList.remove("has-image");
  els.originalLabel.textContent = "Belum ada gambar.";
  els.outputNameInput.value = "";
  applyPreset("logo");
  els.traceBtn.disabled = true;
  els.progressText.textContent = "";
}

function releaseUrl(key) {
  if (state[key]) {
    URL.revokeObjectURL(state[key]);
    state[key] = "";
  }
}

function updateTraceWidthLabel() {
  const value = els.traceWidthInput.value;
  if (els.traceWidthOutput) {
    els.traceWidthOutput.value = `${value} px`;
    els.traceWidthOutput.textContent = `${value} px`;
  }
}

function updateThresholdLabel() {
  els.thresholdOutput.value = els.thresholdInput.value;
  els.thresholdOutput.textContent = els.thresholdInput.value;
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
