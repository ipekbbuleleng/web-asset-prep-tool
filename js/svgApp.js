import {
  copyText,
  downloadBlob,
  downloadZip,
  sanitizeFileBaseName,
  stripExtension
} from "./downloadHelper.js";

import {
  formatBytes
} from "./reportHelper.js";

import {
  getSvgMeta,
  isSvgFile,
  optimizeSvgText,
  readSvgFile,
  svgTextToObjectUrl
} from "./svgProcessor.js";

const APP_VERSION = "1.0.6-r5-final-image-vector";
const MAX_SVG_FILES = 80;

const state = {
  items: [],
  outputFiles: [],
  snippet: "",
  originalPreviewUrl: null,
  outputPreviewUrl: null
};

const els = {
  fileInput: document.querySelector("#svgFileInput"),
  dropZone: document.querySelector("#svgDropZone"),
  fileInfo: document.querySelector("#svgFileInfo"),
  removeCommentsInput: document.querySelector("#removeCommentsInput"),
  removeMetadataInput: document.querySelector("#removeMetadataInput"),
  keepTitleDescInput: document.querySelector("#keepTitleDescInput"),
  keepIdsInput: document.querySelector("#keepIdsInput"),
  processBtn: document.querySelector("#processSvgBtn"),
  downloadBtn: document.querySelector("#downloadSvgBtn"),
  copyBtn: document.querySelector("#copySvgSnippetBtn"),
  resetBtn: document.querySelector("#resetSvgBtn"),
  progressText: document.querySelector("#svgProgressText"),
  originalPreview: document.querySelector("#originalSvgPreview"),
  outputPreview: document.querySelector("#outputSvgPreview"),
  originalLabel: document.querySelector("#originalSvgLabel"),
  outputLabel: document.querySelector("#outputSvgLabel"),
  reportBox: document.querySelector("#svgReportBox"),
  snippetOutput: document.querySelector("#svgSnippetOutput"),
  toast: document.querySelector("#toast")
};

boot();

function boot() {
  bindEvents();
  registerServiceWorker();
  console.info(`SVG Optimizer v${APP_VERSION} aktif`);
}

function bindEvents() {
  els.fileInput.addEventListener("change", () => {
    handleFiles(Array.from(els.fileInput.files || []));
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
    handleFiles(Array.from(event.dataTransfer?.files || []));
  });

  els.processBtn.addEventListener("click", processSvgBatch);
  els.downloadBtn.addEventListener("click", downloadResults);
  els.copyBtn.addEventListener("click", copyAllSnippets);
  els.resetBtn.addEventListener("click", resetApp);
}

async function handleFiles(files) {
  resetStateOnly();

  const selected = files.filter(isSvgFile).slice(0, MAX_SVG_FILES);

  if (selected.length === 0) {
    showToast("Pilih file SVG yang valid.");
    return;
  }

  if (files.length > selected.length) {
    showToast("Sebagian file diabaikan karena bukan SVG atau melebihi batas batch.");
  }

  for (const file of selected) {
    const item = {
      id: crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      file,
      sourceText: "",
      outputText: "",
      meta: null,
      optimizedMeta: null,
      originalSize: file.size,
      outputSize: 0,
      originalUrl: "",
      outputUrl: "",
      status: "reading",
      error: "",
      snippet: ""
    };

    state.items.push(item);

    try {
      item.sourceText = await readSvgFile(file);
      item.meta = getSvgMeta(item.sourceText);
      item.originalUrl = svgTextToObjectUrl(item.sourceText);
      item.status = "ready";
    } catch (error) {
      item.status = "error";
      item.error = error.message || "Gagal membaca SVG.";
    }
  }

  updateFileInfo();
  updateOriginalPreview();
  renderReport();
  els.processBtn.disabled = state.items.filter((item) => item.status === "ready").length === 0;
  showToast(`${state.items.length} SVG dibaca.`);
}

async function processSvgBatch() {
  const readyItems = state.items.filter((item) => item.status === "ready");

  if (readyItems.length === 0) {
    showToast("Tidak ada SVG valid untuk diproses.");
    return;
  }

  clearOutputs();
  els.processBtn.disabled = true;
  els.downloadBtn.disabled = true;
  els.copyBtn.disabled = true;
  els.progressText.textContent = "Memproses SVG...";

  const usedNames = new Set();

  for (let index = 0; index < readyItems.length; index += 1) {
    const item = readyItems[index];
    item.status = "processing";
    renderReport();

    try {
      const optimized = optimizeSvgText(item.sourceText, getOptions());
      const baseName = sanitizeFileBaseName(stripExtension(item.file.name));
      const filename = makeUniqueFilename(`${baseName}-optimized.svg`, usedNames);
      const blob = new Blob([optimized.text], { type: "image/svg+xml" });

      item.outputText = optimized.text;
      item.optimizedMeta = optimized.meta;
      item.outputSize = blob.size;
      item.outputUrl = svgTextToObjectUrl(optimized.text);
      item.snippet = buildSvgSnippet(filename, item);
      item.status = "done";

      state.outputFiles.push({
        blob,
        name: filename,
        size: blob.size,
        sourceName: item.file.name,
        width: optimized.meta.width,
        height: optimized.meta.height
      });
    } catch (error) {
      item.status = "error";
      item.error = error.message || "Gagal optimasi SVG.";
    }

    els.progressText.textContent = `Memproses ${index + 1}/${readyItems.length}`;
    await yieldToBrowser();
  }

  state.snippet = state.items
    .filter((item) => item.snippet)
    .map((item) => `<!-- ${item.file.name} -->\n${item.snippet}`)
    .join("\n\n");

  updateOutputPreview();
  renderReport();
  els.snippetOutput.textContent = state.snippet || "<!-- Tidak ada snippet SVG -->";
  els.downloadBtn.disabled = state.outputFiles.length === 0;
  els.copyBtn.disabled = !state.snippet;
  els.processBtn.disabled = false;
  els.progressText.textContent = `Selesai: ${state.outputFiles.length} SVG berhasil dioptimasi.`;
  showToast("Optimasi SVG selesai.");
}

function getOptions() {
  return {
    removeComments: els.removeCommentsInput.checked,
    removeMetadata: els.removeMetadataInput.checked,
    keepTitleDesc: els.keepTitleDescInput.checked,
    keepIds: els.keepIdsInput.checked
  };
}

function updateFileInfo() {
  const valid = state.items.filter((item) => ["ready", "done"].includes(item.status)).length;
  const failed = state.items.filter((item) => item.status === "error").length;
  const totalSize = state.items.reduce((sum, item) => sum + item.originalSize, 0);

  els.fileInfo.classList.remove("empty");
  els.fileInfo.innerHTML = `
    <strong>${state.items.length} SVG dipilih</strong><br>
    Siap: ${valid} · Gagal: ${failed} · Total asli: ${formatBytes(totalSize)}
  `;
}

function updateOriginalPreview() {
  const item = state.items.find((entry) => entry.originalUrl);

  if (!item) return;

  state.originalPreviewUrl = item.originalUrl;
  els.originalPreview.src = item.originalUrl;
  els.originalPreview.parentElement.classList.add("has-image");
  els.originalLabel.textContent = `${item.file.name} · ${formatSvgDimension(item.meta)}`;
}

function updateOutputPreview() {
  releaseOutputPreview();

  const item = state.items.find((entry) => entry.outputUrl);
  if (!item) return;

  state.outputPreviewUrl = item.outputUrl;
  els.outputPreview.src = item.outputUrl;
  els.outputPreview.parentElement.classList.add("has-image");
  els.outputLabel.textContent = `${item.file.name} · ${formatSvgDimension(item.optimizedMeta)}`;
}

function renderReport() {
  if (state.items.length === 0) {
    els.reportBox.className = "report-box empty";
    els.reportBox.textContent = "Laporan belum tersedia.";
    return;
  }

  els.reportBox.classList.remove("empty");

  const totalOriginal = state.items.reduce((sum, item) => sum + item.originalSize, 0);
  const totalOutput = state.items.reduce((sum, item) => sum + item.outputSize, 0);
  const done = state.items.filter((item) => item.status === "done").length;
  const failed = state.items.filter((item) => item.status === "error").length;
  const savings = totalOutput ? getSavingPercent(totalOriginal, totalOutput) : 0;

  els.reportBox.innerHTML = `
    <div class="svg-summary-grid">
      <div class="svg-summary-card"><strong>${state.items.length}</strong><span>SVG input</span></div>
      <div class="svg-summary-card"><strong>${done}</strong><span>Berhasil</span></div>
      <div class="svg-summary-card"><strong>${formatBytes(totalOutput || totalOriginal)}</strong><span>${totalOutput ? "Total output" : "Total asli"}</span></div>
      <div class="svg-summary-card"><strong>${savings.toFixed(1)}%</strong><span>Penghematan</span></div>
    </div>

    <table class="variant-table">
      <thead>
        <tr>
          <th>File SVG</th>
          <th>ViewBox</th>
          <th>Title/Desc</th>
          <th>Ukuran asli</th>
          <th>Ukuran output</th>
          <th>Penghematan</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${state.items.map((item) => `
          <tr>
            <td>${escapeHtml(item.file.name)}</td>
            <td>${escapeHtml(item.optimizedMeta?.viewBox || item.meta?.viewBox || "-")}</td>
            <td>${escapeHtml(getTitleDescLabel(item.optimizedMeta || item.meta))}</td>
            <td>${formatBytes(item.originalSize)}</td>
            <td>${item.outputSize ? formatBytes(item.outputSize) : "-"}</td>
            <td>${item.outputSize ? getSavingPercent(item.originalSize, item.outputSize).toFixed(1) + "%" : "-"}</td>
            <td>${renderStatus(item)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

async function downloadResults() {
  if (state.outputFiles.length === 0) {
    showToast("Belum ada output SVG.");
    return;
  }

  if (state.outputFiles.length === 1) {
    downloadBlob(state.outputFiles[0].blob, state.outputFiles[0].name);
    showToast("Download SVG dimulai.");
    return;
  }

  const zipFiles = [
    ...state.outputFiles.map((file) => ({
      blob: file.blob,
      name: `assets/images/${file.name}`
    })),
    {
      blob: new Blob([state.snippet], { type: "text/html;charset=utf-8" }),
      name: "snippets/all-svg-snippets.html"
    },
    {
      blob: new Blob([JSON.stringify(buildReportJson(), null, 2)], { type: "application/json;charset=utf-8" }),
      name: "reports/svg-report.json"
    }
  ];

  await downloadZip(zipFiles, `svg-assets-${formatTimestampForName(new Date())}.zip`);
  showToast("Download ZIP SVG dimulai.");
}

async function copyAllSnippets() {
  if (!state.snippet) {
    showToast("Snippet belum tersedia.");
    return;
  }

  await copyText(state.snippet);
  showToast("Semua snippet SVG disalin.");
}

function buildSvgSnippet(filename, item) {
  const meta = item.optimizedMeta || item.meta || {};
  const width = isFiniteNumberString(meta.width) ? ` width="${escapeHtml(meta.width)}"` : "";
  const height = isFiniteNumberString(meta.height) ? ` height="${escapeHtml(meta.height)}"` : "";
  const alt = meta.title || stripExtension(item.file.name).replace(/[-_]+/g, " ");

  return `<img src="./assets/images/${escapeHtml(filename)}" alt="${escapeHtml(alt)}"${width}${height} loading="lazy" decoding="async">`;
}

function buildReportJson() {
  return {
    app: "Web Asset Prep Tool",
    version: APP_VERSION,
    module: "svg_optimizer_light",
    generated_at: new Date().toISOString(),
    options: getOptions(),
    input_count: state.items.length,
    output_count: state.outputFiles.length,
    items: state.items.map((item) => ({
      input_name: item.file.name,
      status: item.status,
      error: item.error || "",
      original_size: item.originalSize,
      output_size: item.outputSize,
      saving_percent: item.outputSize ? getSavingPercent(item.originalSize, item.outputSize) : 0,
      viewBox: item.optimizedMeta?.viewBox || item.meta?.viewBox || "",
      width: item.optimizedMeta?.width || item.meta?.width || "",
      height: item.optimizedMeta?.height || item.meta?.height || "",
      title: item.optimizedMeta?.title || item.meta?.title || "",
      desc: item.optimizedMeta?.desc || item.meta?.desc || ""
    }))
  };
}

function clearOutputs() {
  releaseOutputPreview();
  state.outputFiles = [];
  state.snippet = "";

  state.items.forEach((item) => {
    if (item.outputUrl) {
      URL.revokeObjectURL(item.outputUrl);
    }

    item.outputUrl = "";
    item.outputText = "";
    item.outputSize = 0;
    item.optimizedMeta = null;
    item.snippet = "";

    if (item.status === "done" || item.status === "processing") {
      item.status = "ready";
    }
  });

  els.outputPreview.removeAttribute("src");
  els.outputPreview.parentElement.classList.remove("has-image");
  els.outputLabel.textContent = "Hasil akan tampil setelah diproses.";
  els.snippetOutput.textContent = "<!-- Snippet SVG akan muncul setelah diproses -->";
  els.downloadBtn.disabled = true;
  els.copyBtn.disabled = true;
}

function resetStateOnly() {
  clearOutputs();

  state.items.forEach((item) => {
    if (item.originalUrl) URL.revokeObjectURL(item.originalUrl);
  });

  state.items = [];
  state.originalPreviewUrl = null;
  state.outputPreviewUrl = null;
  state.snippet = "";

  els.originalPreview.removeAttribute("src");
  els.originalPreview.parentElement.classList.remove("has-image");
  els.originalLabel.textContent = "Preview file pertama.";
  els.fileInfo.className = "file-info empty";
  els.fileInfo.textContent = "Belum ada SVG dipilih.";
  renderReport();
}

function resetApp() {
  resetStateOnly();
  els.fileInput.value = "";
  els.processBtn.disabled = true;
  els.downloadBtn.disabled = true;
  els.copyBtn.disabled = true;
  els.progressText.textContent = "";
  els.removeCommentsInput.checked = true;
  els.removeMetadataInput.checked = true;
  els.keepTitleDescInput.checked = true;
  els.keepIdsInput.checked = true;
}

function releaseOutputPreview() {
  if (state.outputPreviewUrl) {
    URL.revokeObjectURL(state.outputPreviewUrl);
    state.outputPreviewUrl = null;
  }
}

function renderStatus(item) {
  if (item.status === "reading") return `<span class="status-pill status-check">Membaca</span>`;
  if (item.status === "ready") return `<span class="status-pill status-neutral">Siap</span>`;
  if (item.status === "processing") return `<span class="status-pill status-check">Proses</span>`;
  if (item.status === "done") return `<span class="status-pill status-ready">Selesai</span>`;
  if (item.status === "error") return `<span class="status-pill status-risk">Gagal</span><br><small>${escapeHtml(item.error || "")}</small>`;
  return "-";
}

function getTitleDescLabel(meta) {
  const title = meta?.title ? "title" : "";
  const desc = meta?.desc ? "desc" : "";
  return [title, desc].filter(Boolean).join(" + ") || "-";
}

function formatSvgDimension(meta) {
  if (!meta) return "-";
  const viewBox = meta.viewBox ? ` · viewBox ${meta.viewBox}` : "";
  return `${meta.width || "-"} × ${meta.height || "-"}${viewBox}`;
}

function getSavingPercent(originalSize, outputSize) {
  if (!originalSize || !outputSize) return 0;
  return Math.max(0, (1 - outputSize / originalSize) * 100);
}

function makeUniqueFilename(filename, usedNames) {
  if (!usedNames.has(filename)) {
    usedNames.add(filename);
    return filename;
  }

  const dotIndex = filename.lastIndexOf(".");
  const base = dotIndex >= 0 ? filename.slice(0, dotIndex) : filename;
  const ext = dotIndex >= 0 ? filename.slice(dotIndex) : "";
  let counter = 2;

  while (usedNames.has(`${base}-${counter}${ext}`)) {
    counter += 1;
  }

  const nextName = `${base}-${counter}${ext}`;
  usedNames.add(nextName);
  return nextName;
}

function isFiniteNumberString(value) {
  return Number.isFinite(Number(value));
}

function formatTimestampForName(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("") + "-" + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("");
}

function yieldToBrowser() {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
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
