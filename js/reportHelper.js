export function formatBytes(bytes) {
  const value = Number(bytes) || 0;

  if (value < 1024) return `${value} B`;

  const units = ["KB", "MB", "GB"];
  let size = value / 1024;
  let index = 0;

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }

  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[index]}`;
}

export function getSavingPercent(originalSize, outputSize) {
  if (!originalSize || !outputSize) return 0;
  return Math.max(0, (1 - outputSize / originalSize) * 100);
}

export function buildRecommendation({ savingPercent, outputSize, outputWidth }) {
  if (outputSize <= 550 * 1024 && outputWidth <= 1600) {
    return {
      label: "Siap web",
      className: "status-ready",
      note: "Ukuran dan dimensi sudah aman untuk sebagian besar kebutuhan web/PWA."
    };
  }

  if (savingPercent >= 50 && outputSize <= 1024 * 1024) {
    return {
      label: "Cukup baik",
      className: "status-check",
      note: "Sudah jauh lebih ringan, tetapi masih bisa disesuaikan untuk halaman yang sangat ringan."
    };
  }

  return {
    label: "Perlu cek ulang",
    className: "status-risk",
    note: "Pertimbangkan menurunkan width atau quality agar lebih ringan."
  };
}

export function renderSingleReport({
  originalName,
  outputName,
  originalType,
  outputType,
  originalSize,
  outputSize,
  originalWidth,
  originalHeight,
  outputWidth,
  outputHeight
}) {
  const savingPercent = getSavingPercent(originalSize, outputSize);
  const recommendation = buildRecommendation({
    savingPercent,
    outputSize,
    outputWidth
  });

  const rows = [
    ["Nama file asli", escapeHtml(originalName)],
    ["Format asli", escapeHtml(originalType || "-")],
    ["Ukuran asli", formatBytes(originalSize)],
    ["Dimensi asli", `${originalWidth} × ${originalHeight}px`],
    ["Nama output", escapeHtml(outputName)],
    ["Format output", escapeHtml(outputType || "-")],
    ["Ukuran output", formatBytes(outputSize)],
    ["Dimensi output", `${outputWidth} × ${outputHeight}px`],
    ["Penghematan", `${savingPercent.toFixed(1)}%`],
    [
      "Status rekomendasi",
      `<span class="status-pill ${recommendation.className}">${recommendation.label}</span><br><small>${recommendation.note}</small>`
    ]
  ];

  return `
    <table class="report-table">
      <tbody>
        ${rows.map(([key, value]) => `
          <tr>
            <th scope="row">${key}</th>
            <td>${value}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

export function renderResponsiveReport({
  originalName,
  originalType,
  originalSize,
  originalWidth,
  originalHeight,
  outputType,
  widthsText,
  outputs
}) {
  const totalSize = outputs.reduce((sum, item) => sum + item.size, 0);
  const largest = outputs.reduce((best, item) => !best || item.width > best.width ? item : best, null);
  const savingPercent = largest ? getSavingPercent(originalSize, largest.size) : 0;
  const recommendation = buildRecommendation({
    savingPercent,
    outputSize: largest?.size || 0,
    outputWidth: largest?.width || 0
  });

  return `
    <table class="report-table">
      <tbody>
        <tr><th scope="row">Nama file asli</th><td>${escapeHtml(originalName)}</td></tr>
        <tr><th scope="row">Format asli</th><td>${escapeHtml(originalType || "-")}</td></tr>
        <tr><th scope="row">Ukuran asli</th><td>${formatBytes(originalSize)}</td></tr>
        <tr><th scope="row">Dimensi asli</th><td>${originalWidth} × ${originalHeight}px</td></tr>
        <tr><th scope="row">Mode output</th><td>Responsive Image Generator</td></tr>
        <tr><th scope="row">Format output</th><td>${escapeHtml(outputType || "-")}</td></tr>
        <tr><th scope="row">Daftar width</th><td>${escapeHtml(widthsText)}</td></tr>
        <tr><th scope="row">Jumlah varian</th><td>${outputs.length} file</td></tr>
        <tr><th scope="row">Total ukuran semua varian</th><td>${formatBytes(totalSize)}</td></tr>
        <tr><th scope="row">Status rekomendasi</th><td><span class="status-pill ${recommendation.className}">${recommendation.label}</span><br><small>${recommendation.note}</small></td></tr>
      </tbody>
    </table>

    <h3>Detail varian output</h3>
    <table class="variant-table">
      <thead>
        <tr>
          <th>Nama output</th>
          <th>Dimensi</th>
          <th>Ukuran</th>
          <th>Penghematan vs file asli</th>
        </tr>
      </thead>
      <tbody>
        ${outputs.map((item) => `
          <tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${item.width} × ${item.height}px</td>
            <td>${formatBytes(item.size)}</td>
            <td>${getSavingPercent(originalSize, item.size).toFixed(1)}%</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <div class="note-box">
      Gunakan tombol <strong>Download hasil</strong> untuk mengunduh semua varian dalam file ZIP.
    </div>
  `;
}

export function renderBatchReport({ items, outputFiles, outputMode }) {
  const totalOriginalSize = items.reduce((sum, item) => sum + item.file.size, 0);
  const totalOutputSize = outputFiles.reduce((sum, item) => sum + item.size, 0);
  const successItems = items.filter((item) => item.status === "done");
  const failedItems = items.filter((item) => item.status === "error");
  const savingPercent = getSavingPercent(totalOriginalSize, totalOutputSize);
  const largestOutput = outputFiles.reduce((best, item) => !best || item.size > best.size ? item : best, null);
  const recommendation = buildRecommendation({
    savingPercent,
    outputSize: largestOutput?.size || totalOutputSize,
    outputWidth: largestOutput?.width || 1200
  });

  return `
    <table class="report-table">
      <tbody>
        <tr><th scope="row">Mode output</th><td>${escapeHtml(outputMode)}</td></tr>
        <tr><th scope="row">Jumlah file input</th><td>${items.length} file</td></tr>
        <tr><th scope="row">Berhasil</th><td>${successItems.length} file</td></tr>
        <tr><th scope="row">Gagal</th><td>${failedItems.length} file</td></tr>
        <tr><th scope="row">Jumlah file output</th><td>${outputFiles.length} file</td></tr>
        <tr><th scope="row">Total ukuran asli</th><td>${formatBytes(totalOriginalSize)}</td></tr>
        <tr><th scope="row">Total ukuran output</th><td>${formatBytes(totalOutputSize)}</td></tr>
        <tr><th scope="row">Penghematan total</th><td>${savingPercent.toFixed(1)}%</td></tr>
        <tr><th scope="row">Status rekomendasi</th><td><span class="status-pill ${recommendation.className}">${recommendation.label}</span><br><small>${recommendation.note}</small></td></tr>
      </tbody>
    </table>

    <h3>Detail batch</h3>
    <table class="variant-table">
      <thead>
        <tr>
          <th>File input</th>
          <th>Dimensi asli</th>
          <th>Ukuran asli</th>
          <th>Output</th>
          <th>Total output</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item) => `
          <tr>
            <td>${escapeHtml(item.file.name)}</td>
            <td>${item.meta ? `${item.meta.width} × ${item.meta.height}px` : "-"}</td>
            <td>${formatBytes(item.file.size)}</td>
            <td>${item.outputs.length} file</td>
            <td>${formatBytes(item.outputs.reduce((sum, output) => sum + output.size, 0))}</td>
            <td>${renderStatus(item)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <div class="note-box">
      Tombol <strong>Download hasil</strong> akan membuat file ZIP berisi semua output batch.
    </div>
  `;
}

export function buildImgSnippet({ filename, alt, width, height }) {
  const safeAlt = escapeAttribute(alt || "Deskripsi gambar");
  const safeFile = escapeAttribute(filename);

  return `<img src="./assets/images/${safeFile}" alt="${safeAlt}" width="${width}" height="${height}" loading="lazy" decoding="async">`;
}

export function buildPictureSnippet({ outputs, alt, sizes, mimeType }) {
  const safeAlt = escapeAttribute(alt || "Deskripsi gambar");
  const safeSizes = escapeAttribute(sizes || "100vw");
  const ordered = [...outputs].sort((a, b) => a.width - b.width);
  const fallback = pickFallbackVariant(ordered);

  const srcset = ordered
    .map((item) => `./assets/images/${escapeAttribute(item.name)} ${item.width}w`)
    .join(",\n      ");

  return `<picture>
  <source
    type="${escapeAttribute(mimeType)}"
    srcset="
      ${srcset}
    "
    sizes="${safeSizes}"
  >
  <img src="./assets/images/${escapeAttribute(fallback.name)}" alt="${safeAlt}" width="${fallback.width}" height="${fallback.height}" loading="lazy" decoding="async">
</picture>`;
}

function renderStatus(item) {
  if (item.status === "done") return `<span class="status-pill status-ready">Selesai</span>`;
  if (item.status === "error") return `<span class="status-pill status-risk">Gagal</span><br><small>${escapeHtml(item.error || "")}</small>`;
  if (item.status === "processing") return `<span class="status-pill status-check">Proses</span>`;
  return `<span class="status-pill status-neutral">Siap</span>`;
}

function pickFallbackVariant(outputs) {
  if (outputs.length === 1) return outputs[0];
  const preferred = outputs.find((item) => item.width >= 800);
  return preferred || outputs[outputs.length - 1];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
