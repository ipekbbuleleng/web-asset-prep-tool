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

export function renderReport({
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

export function buildImgSnippet({ filename, alt, width, height }) {
  const safeAlt = escapeAttribute(alt || "Deskripsi gambar");
  const safeFile = escapeAttribute(filename);

  return `<img src="./assets/images/${safeFile}" alt="${safeAlt}" width="${width}" height="${height}" loading="lazy" decoding="async">`;
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
