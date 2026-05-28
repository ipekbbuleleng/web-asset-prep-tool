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

const APP_VERSION = "1.0.5-raster-tracer";

const state = {
  file: null,
  processableFile: null,
  originalUrl: "",
  outputUrl: "",
  outputBlob: null,
  outputName: "",
  snippet: "",
  sourceMeta: null,
  outputMeta: null
};

const els = {
  fileInput: document.querySelector("#tracerFileInput"),
  dropZone: document.querySelector("#tracerDropZone"),
  fileInfo: document.querySelector("#tracerFileInfo"),
  outputNameInput: document.querySelector("#outputNameInput"),
  traceWidthInput: document.querySelector("#traceWidthInput"),
  thresholdInput: document.querySelector("#thresholdInput"),
  thresholdOutput: document.querySelector("#thresholdOutput"),
  fillColorInput: document.querySelector("#fillColorInput"),
  invertInput: document.querySelector("#invertInput"),
  transparentInput: document.querySelector("#transparentInput"),
  traceBtn: document.querySelector("#traceBtn"),
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
  registerServiceWorker();
  updateThresholdLabel();
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

  els.thresholdInput.addEventListener("input", updateThresholdLabel);
  els.traceBtn.addEventListener("click", traceCurrentFile);
  els.downloadBtn.addEventListener("click", downloadCurrentSvg);
  els.copyBtn.addEventListener("click", copyCurrentSnippet);
  els.resetBtn.addEventListener("click", resetApp);
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

    els.reportBox.classList.remove("empty");
    els.reportBox.innerHTML = renderReport(result.meta, state.outputName, result.blob.size);

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

function renderReport(meta, outputName, outputSize) {
  const originalSize = state.file?.size || 0;
  const saving = originalSize && outputSize
    ? Math.max(0, (1 - outputSize / originalSize) * 100)
    : 0;

  const status = getRecommendation(meta, outputSize);

  return `
    <table class="report-table">
      <tbody>
        <tr><th scope="row">Nama file asli</th><td>${escapeHtml(state.file.name)}</td></tr>
        <tr><th scope="row">Dimensi asli</th><td>${meta.sourceWidth} × ${meta.sourceHeight}px</td></tr>
        <tr><th scope="row">Ukuran asli</th><td>${formatBytes(originalSize)}</td></tr>
        <tr><th scope="row">Nama output</th><td>${escapeHtml(outputName)}</td></tr>
        <tr><th scope="row">Dimensi SVG</th><td>${meta.width} × ${meta.height} viewBox</td></tr>
        <tr><th scope="row">Ukuran SVG</th><td>${formatBytes(outputSize)}</td></tr>
        <tr><th scope="row">Path segment</th><td>${meta.runCount}</td></tr>
        <tr><th scope="row">Pixel aktif</th><td>${meta.activePixelCount}</td></tr>
        <tr><th scope="row">Penghematan vs file asli</th><td>${saving.toFixed(1)}%</td></tr>
        <tr><th scope="row">Status rekomendasi</th><td><span class="status-pill ${status.className}">${status.label}</span><br><small>${status.note}</small></td></tr>
      </tbody>
    </table>
    <div class="note-box">
      Jika path segment terlalu besar atau SVG lebih berat dari WebP, turunkan lebar tracing atau gunakan Image Tool.
    </div>
  `;
}

function getRecommendation(meta, outputSize) {
  if (meta.runCount <= 2500 && outputSize <= 180 * 1024) {
    return {
      label: "Cocok untuk SVG",
      className: "status-ready",
      note: "Jumlah path masih ringan untuk ikon/logo sederhana."
    };
  }

  if (meta.runCount <= 8000 && outputSize <= 512 * 1024) {
    return {
      label: "Perlu cek visual",
      className: "status-check",
      note: "Masih bisa dipakai, tetapi cek ukuran dan rendering di HP."
    };
  }

  return {
    label: "Tidak disarankan",
    className: "status-risk",
    note: "Terlalu kompleks untuk SVG. Lebih baik gunakan WebP/JPG/PNG."
  };
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
  els.traceWidthInput.value = 256;
  els.thresholdInput.value = 128;
  els.fillColorInput.value = "#111827";
  els.invertInput.checked = false;
  els.transparentInput.checked = true;
  els.traceBtn.disabled = true;
  els.progressText.textContent = "";
  updateThresholdLabel();
}

function releaseUrl(key) {
  if (state[key]) {
    URL.revokeObjectURL(state[key]);
    state[key] = "";
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
