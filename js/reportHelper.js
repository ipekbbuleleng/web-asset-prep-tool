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
      Gunakan tombol <strong>Download hasil</strong> untuk mengunduh semua varian sekaligus secara berurutan.
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
