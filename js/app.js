import {
  getOutputExtension,
  isSupportedImage,
  processImageFile,
  readImageMeta
} from "./imageProcessor.js";

import {
  copyText,
  downloadBlob,
  downloadZip,
  sanitizeFileBaseName,
  stripExtension
} from "./downloadHelper.js";

import {
  buildImgSnippet,
  buildPictureSnippet,
  formatBytes,
  renderBatchReport,
  renderResponsiveReport,
  renderSingleReport
} from "./reportHelper.js";

import {
  convertHeicToJpegFile,
  getReadableMimeLabel,
  isHeicFile
} from "./heicAdapter.js";

const APP_VERSION = "1.0.5-r5-r3-r2-bg-color-picker";
const MAX_BATCH_FILES = 30;

const PRESETS = {
  custom: null,
  activity: { width: 1200, quality: 80, mimeType: "image/webp", suffix: "kegiatan-1200", responsiveMode: false },
  thumb: { width: 480, quality: 75, mimeType: "image/webp", suffix: "kegiatan-thumb-480", responsiveMode: false },
  profile: { width: 512, quality: 80, mimeType: "image/webp", suffix: "profile-512", responsiveMode: false },
  hero: { width: 1200, quality: 80, mimeType: "image/webp", suffix: "hero", responsiveMode: true, widths: "480, 800, 1200, 1600", sizes: "(max-width: 600px) 480px, (max-width: 1024px) 800px, 1200px" },
  screenshot: { width: 1200, quality: 85, mimeType: "image/webp", suffix: "screenshot-1200", responsiveMode: false }
};

const state = {
  items: [],
  originalPreviewUrl: null,
  outputPreviewUrl: null,
  outputFiles: [],
  snippet: "",
  outputNameTouched: false,
  bgColorPickerArmed: false
};

const els = {
  fileInput: document.querySelector("#fileInput"),
  dropZone: document.querySelector("#dropZone"),
  fileInfo: document.querySelector("#fileInfo"),
  batchList: document.querySelector("#batchList"),
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
  bgRemoveInput: document.querySelector("#bgRemoveInput"),
  bgModeSelect: document.querySelector("#bgModeSelect"),
  bgColorInput: document.querySelector("#bgColorInput"),
  bgPickFromImageBtn: document.querySelector("#bgPickFromImageBtn"),
  bgPickHint: document.querySelector("#bgPickHint"),
  bgToleranceInput: document.querySelector("#bgToleranceInput"),
  bgToleranceOutput: document.querySelector("#bgToleranceOutput"),
  bgFeatherInput: document.querySelector("#bgFeatherInput"),
  bgFeatherOutput: document.querySelector("#bgFeatherOutput"),
  bgSafetyBox: document.querySelector("#bgSafetyBox"),
  processBtn: document.querySelector("#processBtn"),
  downloadBtn: document.querySelector("#downloadBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  copySnippetBtn: document.querySelector("#copySnippetBtn"),
  progressText: document.querySelector("#progressText"),
  originalPreview: document.querySelector("#originalPreview"),
  originalPreviewLabel: document.querySelector("#originalPreviewLabel"),
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
  syncBackgroundControls();
  updateBackgroundLabels();
  console.info(`Web Asset Prep Tool v${APP_VERSION} aktif`);
}

function bindEvents() {
  els.fileInput.addEventListener("change", () => handleFiles(Array.from(els.fileInput.files || [])));

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

  els.dropZone.addEventListener("drop", (event) => handleFiles(Array.from(event.dataTransfer?.files || [])));

  els.batchList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-copy-snippet]");
    if (!button) return;

    const id = button.getAttribute("data-copy-snippet");
    const item = state.items.find((entry) => entry.id === id);

    if (!item?.snippet) {
      showToast("Snippet file ini belum tersedia.");
      return;
    }

    await copyText(item.snippet);
    showToast(`Snippet disalin: ${item.file.name}`);
  });

  els.presetSelect.addEventListener("change", () => {
    state.outputNameTouched = false;
    applyPreset();
  });

  els.qualityInput.addEventListener("input", updateQualityLabel);
  els.processBtn.addEventListener("click", processBatch);
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
      if (!state.outputNameTouched) updateOutputNameSuggestion(false);
    });
  });

  els.outputNameInput.addEventListener("input", () => {
    state.outputNameTouched = !!els.outputNameInput.value.trim();
  });

  els.bgRemoveInput?.addEventListener("change", () => {
    syncBackgroundControls();
  });

  [els.bgModeSelect, els.bgColorInput, els.bgToleranceInput, els.bgFeatherInput].forEach((element) => {
    element?.addEventListener("input", () => {
      updateBackgroundLabels();
      updateBackgroundSafetyBox();
    });
    element?.addEventListener("change", () => {
      syncBackgroundControls();
    });
  });

  els.bgPickFromImageBtn?.addEventListener("click", toggleBackgroundColorPicker);
  els.originalPreview?.addEventListener("click", handleOriginalPreviewColorPick);
}


async function handleFiles(files) {
  clearAll();
  const selected = files.slice(0, MAX_BATCH_FILES);

  if (files.length > MAX_BATCH_FILES) {
    showToast(`Maksimum ${MAX_BATCH_FILES} file per batch. File selebihnya diabaikan.`);
  }

  if (selected.length === 0) return;

  els.processBtn.disabled = true;
  els.progressText.textContent = "Membaca file...";
  showToast(`Membaca ${selected.length} file...`);

  for (const file of selected) {
    const item = createQueueItem(file);
    state.items.push(item);
    renderBatchList();

    try {
      await prepareItem(item);
      item.status = "ready";
    } catch (error) {
      item.status = "error";
      item.error = error.message || "Gagal membaca file.";
    }

    renderBatchList();
    await yieldToBrowser();
  }

  const readyItems = state.items.filter((item) => item.status === "ready");
  updateFileInfo();
  updateOriginalPreview();
  updateOutputNameSuggestion(true);

  els.processBtn.disabled = readyItems.length === 0;
  els.progressText.textContent = readyItems.length > 0 ? `${readyItems.length} file siap diproses.` : "Tidak ada file valid.";
  showToast(`${readyItems.length} file siap diproses.`);
}

function createQueueItem(file) {
  return {
    id: crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    file,
    processableFile: file,
    isHeic: isHeicFile(file),
    meta: null,
    originalObjectUrl: null,
    status: "reading",
    error: "",
    outputs: [],
    snippet: ""
  };
}

async function prepareItem(item) {
  if (!item.isHeic && !isSupportedImage(item.file)) throw new Error("Format belum didukung.");
  if (item.isHeic) item.processableFile = await convertHeicToJpegFile(item.file, { quality: 0.92 });
  item.meta = await readImageMeta(item.processableFile);
  item.originalObjectUrl = item.meta.objectUrl;
}

function updateFileInfo() {
  const readyItems = state.items.filter((item) => item.status === "ready");
  const doneItems = state.items.filter((item) => item.status === "done");
  const errorItems = state.items.filter((item) => item.status === "error");
  const totalSize = state.items.reduce((sum, item) => sum + item.file.size, 0);
  const heicCount = state.items.filter((item) => item.isHeic).length;

  els.fileInfo.classList.remove("empty");
  els.fileInfo.innerHTML = `
    <strong>${state.items.length} file dipilih</strong><br>
    Siap: ${readyItems.length} · Selesai: ${doneItems.length} · Gagal: ${errorItems.length} · HEIC/HEIF: ${heicCount} · Total asli: ${formatBytes(totalSize)}
    ${heicCount ? "<br><small><strong>Catatan:</strong> HEIC/HEIF dikonversi dulu ke JPEG sementara di browser sebelum diproses.</small>" : ""}
  `;
}

function updateOriginalPreview() {
  const firstReady = state.items.find((item) => ["ready", "done"].includes(item.status) && item.originalObjectUrl);
  if (!firstReady) {
    els.originalPreview.removeAttribute("src");
    els.originalPreview.parentElement.classList.remove("has-image");
    els.originalPreviewLabel.textContent = "Preview file pertama.";
    setBackgroundPickerArmed(false);
    return;
  }
  state.originalPreviewUrl = firstReady.originalObjectUrl;
  els.originalPreview.src = firstReady.originalObjectUrl;
  els.originalPreview.parentElement.classList.add("has-image");
  els.originalPreviewLabel.textContent = `${firstReady.file.name} · ${firstReady.meta.width} × ${firstReady.meta.height}px`;
  updateBackgroundPickerUi();
}

function toggleBackgroundColorPicker() {
  if (!els.bgRemoveInput?.checked) {
    showToast("Aktifkan hapus background terlebih dahulu.");
    return;
  }

  if (!state.items.length || !els.originalPreview?.src) {
    showToast("Upload gambar terlebih dahulu agar warna bisa diambil dari preview.");
    return;
  }

  if (els.bgModeSelect) els.bgModeSelect.value = "manual";
  setBackgroundPickerArmed(!state.bgColorPickerArmed);
  syncBackgroundControls();

  if (state.bgColorPickerArmed) {
    showToast("Mode picker aktif. Klik area background pada Preview original.");
  }
}

function setBackgroundPickerArmed(value) {
  state.bgColorPickerArmed = !!value;
  updateBackgroundPickerUi();
}

function updateBackgroundPickerUi() {
  const canPick = !!(els.bgRemoveInput?.checked && state.items.length > 0 && els.originalPreview?.src);
  const previewBox = els.originalPreview?.parentElement;

  if (els.bgPickFromImageBtn) {
    els.bgPickFromImageBtn.disabled = !canPick;
    els.bgPickFromImageBtn.textContent = state.bgColorPickerArmed ? "Batal pilih warna" : "Ambil dari gambar";
  }

  if (els.bgPickHint) {
    const message = state.bgColorPickerArmed
      ? "Mode picker aktif. Klik area background pada preview original untuk mengambil warna."
      : "Klik tombol lalu pilih area background pada preview original. Mode akan otomatis menjadi manual.";
    els.bgPickHint.textContent = message;
    els.bgPickHint.classList.toggle("is-active", state.bgColorPickerArmed);
  }

  previewBox?.classList.toggle("is-pick-color", state.bgColorPickerArmed);
}

function handleOriginalPreviewColorPick(event) {
  if (!state.bgColorPickerArmed) return;

  const img = els.originalPreview;
  if (!img?.src || !img.naturalWidth || !img.naturalHeight) {
    showToast("Preview original belum siap.");
    setBackgroundPickerArmed(false);
    return;
  }

  const rect = img.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const x = Math.max(0, Math.min(img.naturalWidth - 1, Math.floor((event.clientX - rect.left) * (img.naturalWidth / rect.width))));
  const y = Math.max(0, Math.min(img.naturalHeight - 1, Math.floor((event.clientY - rect.top) * (img.naturalHeight / rect.height))));

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    showToast("Browser tidak dapat membaca warna dari preview.");
    setBackgroundPickerArmed(false);
    return;
  }

  ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
  const pixel = ctx.getImageData(x, y, 1, 1).data;
  const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);

  if (els.bgModeSelect) els.bgModeSelect.value = "manual";
  if (els.bgColorInput) els.bgColorInput.value = hex;
  setBackgroundPickerArmed(false);
  syncBackgroundControls();
  updateBackgroundLabels();
  updateBackgroundSafetyBox();
  showToast(`Warna background dipilih: ${hex}`);
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;
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
  if (preset.widths) els.responsiveWidthsInput.value = preset.widths;
  if (preset.sizes) els.sizesInput.value = preset.sizes;
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

function getCurrentPreset() { return PRESETS[els.presetSelect.value] || null; }
function getDefaultSuffix() {
  const preset = getCurrentPreset();
  if (preset?.suffix) return preset.suffix;
  if (els.responsiveModeInput.checked) return "responsive";
  return `${Number(els.widthInput.value) || 1200}`;
}

function updateOutputNameSuggestion(force = false) {
  const suggestion = state.items.length > 1 ? getDefaultSuffix() : computeSingleSuggestedBaseName();
  els.outputNameInput.placeholder = suggestion;
  if (force || !els.outputNameInput.value.trim() || !state.outputNameTouched) els.outputNameInput.value = suggestion;
}

function computeSingleSuggestedBaseName() {
  const first = state.items[0];
  const fileBase = sanitizeFileBaseName(stripExtension(first?.file?.name || "asset"));
  return `${fileBase}-${getDefaultSuffix()}`;
}

async function processBatch() {
  const processableItems = state.items.filter((item) => item.status === "ready" || item.status === "done");
  if (processableItems.length === 0) {
    showToast("Tidak ada file valid untuk diproses.");
    return;
  }

  els.processBtn.disabled = true;
  els.downloadBtn.disabled = true;
  els.copySnippetBtn.disabled = true;
  els.processBtn.textContent = "Memproses...";
  els.progressText.textContent = "Memulai proses batch...";
  clearOutputOnly();

  const readyItems = state.items.filter((item) => item.status === "ready");

  const mimeType = getEffectiveOutputMimeType();
  const ext = getOutputExtension(mimeType);
  const backgroundRemoval = getBackgroundRemovalOptions();
  const responsiveMode = els.responsiveModeInput.checked;
  const widths = responsiveMode ? parseWidths(els.responsiveWidthsInput.value) : [];

  if (responsiveMode && widths.length === 0) {
    showToast("Isi daftar width responsive terlebih dahulu.");
    els.processBtn.disabled = false;
    els.processBtn.textContent = "Proses gambar";
    return;
  }

  const usedNames = new Set();
  const snippets = [];

  for (let index = 0; index < readyItems.length; index += 1) {
    const item = readyItems[index];
    item.status = "processing";
    item.error = "";
    item.outputs = [];
    item.snippet = "";
    renderBatchList();
    els.progressText.textContent = `Memproses ${index + 1}/${readyItems.length}: ${item.file.name}`;

    try {
      const baseName = getBaseNameForItem(item, readyItems.length > 1);
      if (responsiveMode) {
        for (const width of widths) {
          const result = await processImageFile(item.processableFile, {
            width,
            quality: Number(els.qualityInput.value),
            mimeType,
            preventUpscale: els.preventUpscaleInput.checked,
            backgroundRemoval
          });
          const filename = makeUniqueFilename(`${baseName}-${result.outputMeta.width}.${ext}`, usedNames);
          const output = createOutputRecord(result, filename, item);
          item.outputs.push(output);
          state.outputFiles.push(output);
          await yieldToBrowser();
        }
        item.snippet = buildPictureSnippet({ outputs: item.outputs, alt: getAltTextForItem(item), sizes: els.sizesInput.value, mimeType });
      } else {
        const result = await processImageFile(item.processableFile, {
          width: Number(els.widthInput.value),
          quality: Number(els.qualityInput.value),
          mimeType,
          preventUpscale: els.preventUpscaleInput.checked,
          backgroundRemoval
        });
        const filename = makeUniqueFilename(`${baseName}.${ext}`, usedNames);
        const output = createOutputRecord(result, filename, item);
        item.outputs.push(output);
        state.outputFiles.push(output);
        item.snippet = buildImgSnippet({ filename, alt: getAltTextForItem(item), width: result.outputMeta.width, height: result.outputMeta.height });
      }
      item.status = "done";
      snippets.push(`<!-- ${item.file.name} -->\n${item.snippet}`);
      renderBatchList();
    } catch (error) {
      item.status = "error";
      item.error = error.message || "Gagal memproses file.";
      renderBatchList();
    }
    updateFileInfo();
    await yieldToBrowser();
  }

  state.snippet = snippets.join("\n\n");
  updateOutputPreview();
  renderReportAfterProcess();
  els.snippetOutput.textContent = state.snippet || "<!-- Tidak ada snippet karena semua file gagal diproses -->";

  const successCount = readyItems.filter((item) => item.status === "done").length;
  els.downloadBtn.disabled = state.outputFiles.length === 0;
  els.copySnippetBtn.disabled = !state.snippet;
  els.processBtn.disabled = false;
  els.processBtn.textContent = "Proses gambar";
  els.progressText.textContent = `Selesai: ${successCount}/${readyItems.length} file berhasil. ZIP akan berisi assets/images, snippets, dan reports.`;
  showToast(`Batch selesai: ${state.outputFiles.length} file output dibuat.`);
}

function createOutputRecord(result, filename, item) {
  return { blob: result.blob, name: filename, size: result.outputMeta.size, type: result.outputMeta.type, width: result.outputMeta.width, height: result.outputMeta.height, sourceName: item.file.name, originalSize: item.file.size, backgroundRemoval: result.backgroundRemoval || null };
}

function getBaseNameForItem(item, isBatch) {
  const fileBase = sanitizeFileBaseName(stripExtension(item.file.name));
  const inputValue = sanitizeFileBaseName(els.outputNameInput.value.trim() || getDefaultSuffix());
  return isBatch ? `${fileBase}-${inputValue}` : (inputValue || `${fileBase}-${getDefaultSuffix()}`);
}

function getAltTextForItem(item) {
  const baseAlt = els.altInput.value.trim();
  if (state.items.length <= 1) return baseAlt || "Deskripsi gambar";
  const fileLabel = stripExtension(item.file.name).replace(/[-_]+/g, " ").trim();
  return baseAlt ? `${baseAlt} - ${fileLabel}` : fileLabel || "Deskripsi gambar";
}

function updateOutputPreview() {
  releaseOutputPreview();
  const previewOutput = [...state.outputFiles].sort((a, b) => b.width - a.width)[0];
  if (!previewOutput) {
    els.outputPreview.removeAttribute("src");
    els.outputPreview.parentElement.classList.remove("has-image");
    els.outputPreviewLabel.textContent = "Tidak ada output.";
    return;
  }
  state.outputPreviewUrl = URL.createObjectURL(previewOutput.blob);
  els.outputPreview.src = state.outputPreviewUrl;
  els.outputPreview.parentElement.classList.add("has-image");
  els.outputPreviewLabel.textContent = `Preview output terbesar: ${previewOutput.name} · ${previewOutput.width} × ${previewOutput.height}px`;
}

function renderReportAfterProcess() {
  els.reportBox.classList.remove("empty");
  const doneItems = state.items.filter((item) => item.status === "done");
  if (state.items.length === 1 && doneItems.length === 1) {
    const item = doneItems[0];
    if (els.responsiveModeInput.checked) {
      els.reportBox.innerHTML = renderResponsiveReport({ originalName: item.file.name, originalType: getReadableMimeLabel(item.file), originalSize: item.file.size, originalWidth: item.meta.width, originalHeight: item.meta.height, outputType: els.formatSelect.value, widthsText: parseWidths(els.responsiveWidthsInput.value).join(", "), outputs: item.outputs });
      return;
    }
    const output = item.outputs[0];
    els.reportBox.innerHTML = renderSingleReport({ originalName: item.file.name, outputName: output.name, originalType: getReadableMimeLabel(item.file), outputType: output.type, originalSize: item.file.size, outputSize: output.size, originalWidth: item.meta.width, originalHeight: item.meta.height, outputWidth: output.width, outputHeight: output.height }) + renderBackgroundRemovalDetails(output);
    return;
  }
  els.reportBox.innerHTML = renderBatchReport({ items: state.items, outputFiles: state.outputFiles, outputMode: els.responsiveModeInput.checked ? "Batch Responsive Image Generator" : "Batch Single Output" });
}

async function downloadCurrentOutput() {
  if (state.outputFiles.length === 0) {
    showToast("Belum ada output untuk didownload.");
    return;
  }
  if (state.outputFiles.length === 1 && state.items.length === 1) {
    downloadBlob(state.outputFiles[0].blob, state.outputFiles[0].name);
    showToast("Download dimulai.");
    return;
  }
  const zipName = `web-assets-${formatTimestampForName(new Date())}.zip`;
  const zipFiles = buildZipFileList();
  els.progressText.textContent = "Membuat ZIP rapi...";
  await downloadZip(zipFiles, zipName);
  els.progressText.textContent = `ZIP siap: ${zipName} · ${zipFiles.length} item`;
  showToast("Download ZIP dimulai.");
}

function buildZipFileList() {
  const imageFiles = state.outputFiles.map((output) => ({ blob: output.blob, name: `assets/images/${output.name}` }));
  const snippetFiles = [
    { blob: new Blob([state.snippet || ""], { type: "text/html;charset=utf-8" }), name: "snippets/all-snippets.html" },
    ...state.items.filter((item) => item.snippet).map((item) => ({ blob: new Blob([item.snippet], { type: "text/html;charset=utf-8" }), name: `snippets/per-file/${sanitizeFileBaseName(stripExtension(item.file.name))}.html` }))
  ];
  const report = buildReportJson();
  const reportFiles = [
    { blob: new Blob([JSON.stringify(report, null, 2)], { type: "application/json;charset=utf-8" }), name: "reports/asset-report.json" },
    { blob: new Blob([buildReportCsv(report)], { type: "text/csv;charset=utf-8" }), name: "reports/asset-report.csv" }
  ];
  return [...imageFiles, ...snippetFiles, ...reportFiles];
}

function buildReportJson() {
  return {
    app: "Web Asset Prep Tool",
    version: APP_VERSION,
    generated_at: new Date().toISOString(),
    mode: els.responsiveModeInput.checked ? "batch_responsive" : "batch_single",
    output_format: els.formatSelect.value,
    quality: Number(els.qualityInput.value),
    prevent_upscale: els.preventUpscaleInput.checked,
    responsive_widths: els.responsiveModeInput.checked ? parseWidths(els.responsiveWidthsInput.value) : [],
    sizes: els.sizesInput.value,
    background_removal: getBackgroundRemovalOptions(),
    input_count: state.items.length,
    output_count: state.outputFiles.length,
    total_input_size: state.items.reduce((sum, item) => sum + item.file.size, 0),
    total_output_size: state.outputFiles.reduce((sum, output) => sum + output.size, 0),
    items: state.items.map((item) => ({
      input_name: item.file.name,
      input_type: getReadableMimeLabel(item.file),
      input_size: item.file.size,
      input_width: item.meta?.width || null,
      input_height: item.meta?.height || null,
      status: item.status,
      error: item.error || "",
      outputs: item.outputs.map((output) => ({ name: output.name, type: output.type, size: output.size, width: output.width, height: output.height, background_removal: output.backgroundRemoval || null }))
    }))
  };
}

function buildReportCsv(report) {
  const rows = [["input_name", "status", "input_size", "input_width", "input_height", "output_name", "output_size", "output_width", "output_height"]];
  report.items.forEach((item) => {
    if (!item.outputs.length) {
      rows.push([item.input_name, item.status, item.input_size, item.input_width || "", item.input_height || "", "", "", "", ""]);
      return;
    }
    item.outputs.forEach((output) => rows.push([item.input_name, item.status, item.input_size, item.input_width || "", item.input_height || "", output.name, output.size, output.width, output.height]));
  });
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function copyCurrentSnippet() {
  if (!state.snippet) {
    showToast("Snippet belum tersedia.");
    return;
  }
  await copyText(state.snippet);
  showToast("Semua snippet berhasil disalin.");
}

function renderBatchList() {
  if (state.items.length === 0) {
    els.batchList.className = "batch-list empty";
    els.batchList.textContent = "Daftar batch akan muncul setelah file dipilih.";
    return;
  }
  els.batchList.className = "batch-list";
  els.batchList.innerHTML = `
    <table class="batch-table">
      <thead><tr><th>No</th><th>File</th><th>Format</th><th>Ukuran asli</th><th>Dimensi</th><th>Output</th><th>Status</th><th>Aksi</th></tr></thead>
      <tbody>
        ${state.items.map((item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(item.file.name)}</td>
            <td>${escapeHtml(getReadableMimeLabel(item.file))}</td>
            <td>${formatBytes(item.file.size)}</td>
            <td>${item.meta ? `${item.meta.width} × ${item.meta.height}px` : "-"}</td>
            <td>${item.outputs.length ? `${item.outputs.length} file · ${formatBytes(item.outputs.reduce((sum, output) => sum + output.size, 0))}` : "-"}</td>
            <td>${renderItemStatus(item)}</td>
            <td class="actions-cell">${renderItemActions(item)}</td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

function renderItemActions(item) {
  if (!item.snippet) return `<button type="button" class="mini-btn" disabled>Copy snippet</button>`;
  return `<button type="button" class="mini-btn" data-copy-snippet="${escapeHtml(item.id)}">Copy snippet</button>`;
}

function renderItemStatus(item) {
  if (item.status === "reading") return `<span class="status-pill status-check">Membaca</span>`;
  if (item.status === "ready") return `<span class="status-pill status-neutral">Siap</span>`;
  if (item.status === "processing") return `<span class="status-pill status-check">Proses</span>`;
  if (item.status === "done") return `<span class="status-pill status-ready">Selesai</span>`;
  if (item.status === "error") return `<span class="status-pill status-risk">Gagal</span><br><small>${escapeHtml(item.error || "")}</small>`;
  return "-";
}

function clearOutputOnly() {
  releaseOutputPreview();
  state.outputFiles = [];
  state.snippet = "";
  state.items.forEach((item) => {
    item.outputs = [];
    item.snippet = "";
    if (item.status === "done" || item.status === "processing") item.status = "ready";
  });
  els.outputPreview.removeAttribute("src");
  els.outputPreview.parentElement.classList.remove("has-image");
  els.outputPreviewLabel.textContent = "Hasil akan tampil setelah diproses.";
  els.reportBox.className = "report-box empty";
  els.reportBox.textContent = "Laporan belum tersedia.";
  els.snippetOutput.textContent = "<!-- Snippet akan muncul setelah gambar diproses -->";
  els.downloadBtn.disabled = true;
  els.copySnippetBtn.disabled = true;
  renderBatchList();
}

function clearAll() {
  releaseOutputPreview();
  releaseOriginalObjectUrls();
  setBackgroundPickerArmed(false);
  state.items = [];
  state.outputFiles = [];
  state.snippet = "";
  state.outputNameTouched = false;
  els.outputPreview.removeAttribute("src");
  els.outputPreview.parentElement.classList.remove("has-image");
  els.originalPreview.removeAttribute("src");
  els.originalPreview.parentElement.classList.remove("has-image");
  els.outputPreviewLabel.textContent = "Hasil akan tampil setelah diproses.";
  els.originalPreviewLabel.textContent = "Preview file pertama.";
  els.reportBox.className = "report-box empty";
  els.reportBox.textContent = "Laporan belum tersedia.";
  els.snippetOutput.textContent = "<!-- Snippet akan muncul setelah gambar diproses -->";
  els.downloadBtn.disabled = true;
  els.copySnippetBtn.disabled = true;
  renderBatchList();
}

function resetApp() {
  if (state.items.length > 0) {
    resetSettingsKeepFiles();
    return;
  }

  clearAll();
  els.fileInput.value = "";
  els.fileInfo.className = "file-info empty";
  els.fileInfo.textContent = "Belum ada file dipilih.";
  els.processBtn.disabled = true;
  els.progressText.textContent = "";
  resetSettingsValues();
}

function resetSettingsKeepFiles() {
  clearOutputOnly();
  resetSettingsValues();
  updateFileInfo();
  updateOriginalPreview();
  updateOutputNameSuggestion(true);

  const processableItems = state.items.filter((item) => item.status === "ready" || item.status === "done");
  els.processBtn.disabled = processableItems.length === 0;
  els.progressText.textContent = processableItems.length > 0
    ? "Setting dikembalikan. File upload tetap dipertahankan dan siap diproses ulang."
    : "Setting dikembalikan.";
  showToast("Setting direset. File upload tetap dipertahankan.");
}

function resetSettingsValues() {
  els.outputNameInput.value = "";
  els.altInput.value = "";
  els.presetSelect.value = "custom";
  els.widthInput.value = 1200;
  els.formatSelect.value = "image/webp";
  els.qualityInput.value = 80;
  els.preventUpscaleInput.checked = true;
  els.responsiveModeInput.checked = false;
  if (els.bgRemoveInput) els.bgRemoveInput.checked = false;
  if (els.bgModeSelect) els.bgModeSelect.value = "auto";
  if (els.bgColorInput) els.bgColorInput.value = "#ffffff";
  setBackgroundPickerArmed(false);
  if (els.bgToleranceInput) els.bgToleranceInput.value = 24;
  if (els.bgFeatherInput) els.bgFeatherInput.value = 12;
  els.responsiveWidthsInput.value = "480, 800, 1200";
  els.sizesInput.value = "(max-width: 600px) 480px, (max-width: 1024px) 800px, 1200px";
  state.outputNameTouched = false;
  syncResponsiveControls();
  syncBackgroundControls();
  updateQualityLabel();
  updateBackgroundLabels();
}


function getEffectiveOutputMimeType() {
  const selected = els.formatSelect.value;
  const backgroundRemoval = getBackgroundRemovalOptions();

  if (backgroundRemoval.enabled && selected === "image/jpeg") {
    return "image/png";
  }

  return selected;
}

function getBackgroundRemovalOptions() {
  const enabled = !!els.bgRemoveInput?.checked;

  return {
    enabled,
    mode: els.bgModeSelect?.value === "manual" ? "manual" : "auto",
    color: els.bgColorInput?.value || "#ffffff",
    tolerance: Number(els.bgToleranceInput?.value || 24),
    feather: Number(els.bgFeatherInput?.value || 12)
  };
}

function syncBackgroundControls() {
  const enabled = !!els.bgRemoveInput?.checked;
  const manual = els.bgModeSelect?.value === "manual";

  [els.bgModeSelect, els.bgToleranceInput, els.bgFeatherInput].forEach((element) => {
    if (element) element.disabled = !enabled;
  });

  if (els.bgColorInput) {
    els.bgColorInput.disabled = !enabled || !manual;
  }

  if (!enabled) {
    setBackgroundPickerArmed(false);
  }

  if (els.bgPickFromImageBtn) {
    els.bgPickFromImageBtn.disabled = !enabled || state.items.length === 0 || !els.originalPreview?.src;
  }

  updateBackgroundLabels();
  updateBackgroundSafetyBox();
  updateBackgroundPickerUi();
}

function updateBackgroundLabels() {
  if (els.bgToleranceOutput) {
    els.bgToleranceOutput.value = els.bgToleranceInput?.value || "24";
    els.bgToleranceOutput.textContent = els.bgToleranceInput?.value || "24";
  }

  if (els.bgFeatherOutput) {
    els.bgFeatherOutput.value = els.bgFeatherInput?.value || "12";
    els.bgFeatherOutput.textContent = els.bgFeatherInput?.value || "12";
  }
}

function updateBackgroundSafetyBox() {
  if (!els.bgSafetyBox) return;

  const options = getBackgroundRemovalOptions();

  if (!options.enabled) {
    els.bgSafetyBox.innerHTML = `
      <strong>Catatan:</strong>
      Hapus background ringan bekerja baik untuk latar polos. Jika output format JPG dipilih, sistem otomatis memakai PNG agar transparansi tidak hilang.
    `;
    return;
  }

  const formatNote = els.formatSelect.value === "image/jpeg"
    ? " Output akan dipaksa menjadi PNG karena JPG tidak mendukung transparansi."
    : "";

  const toleranceLevel = options.tolerance >= 55
    ? `<span class="status-pill status-check">Tolerance tinggi</span> Cek tepi objek agar tidak ikut terhapus.`
    : `<span class="status-pill status-ready">Mode ringan</span> Cocok untuk logo/gambar dengan background polos.`;

  const modeNote = options.mode === "manual"
    ? ` <span class="status-pill status-neutral">Manual</span> Warna target saat ini <code>${escapeHtml(options.color)}</code>. Gunakan tombol <strong>Ambil dari gambar</strong> bila ingin memilih langsung dari preview.`
    : ` <span class="status-pill status-neutral">Auto</span> Warna background dibaca dari sudut gambar.`;

  els.bgSafetyBox.innerHTML = `
    <strong>Background remover:</strong>
    ${toleranceLevel}${modeNote}${formatNote}
  `;
}

function renderBackgroundRemovalDetails(output) {
  const info = output?.backgroundRemoval;
  if (!info) return "";

  return `
    <h3>Detail hapus background</h3>
    <table class="variant-table">
      <tbody>
        <tr><th>Mode</th><td>${escapeHtml(info.mode === "manual" ? "Manual" : "Auto dari sudut gambar")}</td></tr>
        <tr><th>Warna target</th><td><code>${escapeHtml(info.targetColor)}</code></td></tr>
        <tr><th>Tolerance</th><td>${info.tolerance}</td></tr>
        <tr><th>Edge softness</th><td>${info.feather}</td></tr>
        <tr><th>Pixel transparan</th><td>${info.transparentPixels} (${info.transparentPercent.toFixed(1)}%)</td></tr>
        <tr><th>Pixel soft edge</th><td>${info.partialAlphaPixels} (${info.partialAlphaPercent.toFixed(1)}%)</td></tr>
      </tbody>
    </table>
    <div class="note-box">
      Jika background belum bersih, naikkan tolerance perlahan. Jika objek ikut hilang, turunkan tolerance atau pilih warna background manual.
    </div>
  `;
}


function parseWidths(value) {
  const unique = Array.from(new Set(String(value || "").split(",").map((item) => Number(item.trim())).filter((item) => Number.isFinite(item) && item >= 64 && item <= 5000).map((item) => Math.round(item))));
  return unique.sort((a, b) => a - b).slice(0, 8);
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
  while (usedNames.has(`${base}-${counter}${ext}`)) counter += 1;
  const nextName = `${base}-${counter}${ext}`;
  usedNames.add(nextName);
  return nextName;
}

function releaseOutputPreview() {
  if (state.outputPreviewUrl) {
    URL.revokeObjectURL(state.outputPreviewUrl);
    state.outputPreviewUrl = null;
  }
}
function releaseOriginalObjectUrls() {
  state.items.forEach((item) => {
    if (item.originalObjectUrl) {
      URL.revokeObjectURL(item.originalObjectUrl);
      item.originalObjectUrl = null;
    }
  });
  state.originalPreviewUrl = null;
}
function updateQualityLabel() {
  els.qualityOutput.value = els.qualityInput.value;
  els.qualityOutput.textContent = els.qualityInput.value;
}
function formatTimestampForName(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("") + "-" + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join("");
}
function yieldToBrowser() { return new Promise((resolve) => window.setTimeout(resolve, 0)); }
function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2800);
}
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => console.warn("Service worker gagal didaftarkan:", error));
  });
}
function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
