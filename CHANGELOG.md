# CHANGELOG — Web Asset Prep Tool

## v1-R5-FINAL — Image & Vector Prep Stabilization

Status: **stabil untuk fase v1**.

Ruang lingkup final:
- Landing page portal 3 modul.
- Image Optimizer Biasa.
- Resize dan convert JPG/PNG/WebP/HEIC/HEIF.
- Responsive Image Generator.
- Batch upload dan batch ZIP.
- HTML snippet generator.
- SVG Optimizer Ringan.
- Raster to SVG Tracer Eksperimental.
- Background Remover Ringan:
  - mode terpisah dari Image Optimizer;
  - color picker dari gambar;
  - connected area background removal;
  - compare before/after;
  - transparency preview note.
- Service worker dan manifest PWA.

Catatan batasan:
- Raster to SVG Tracer tetap eksperimental dan hanya disarankan untuk logo/ikon/gambar sederhana.
- Background Remover Ringan bukan AI background remover. Fitur ini cocok untuk background polos, bukan foto kompleks.
- Modul Video & Animation Prep dan Document & Office Prep masih fondasi navigasi, belum fitur operasional penuh.

## Rekomendasi tahap berikutnya
1. v1-R6 — Video & Animation Prep Basic.
2. v1-R7 — Document & Office Prep Basic.
3. v2 — Optional backend/hybrid untuk proses berat.
