# Web Asset Prep Tool v1-R5-FINAL-R1 — Landing Badge Hard Fix

**Web Asset Prep Tool** adalah PWA lokal tanpa backend untuk menyiapkan aset sebelum masuk ke repository web, PWA, landing page, dashboard, portal publik, atau sistem internal.

Paket ini mengunci modul **Image & Vector Prep** sebagai stabil untuk fase v1.

## Status modul

| Modul | Status | Catatan |
|---|---:|---|
| Landing Page Portal | Stabil | Portal 3 modul: Image, Video, Office |
| Image Optimizer Biasa | Stabil | Resize dan convert JPG/PNG/WebP/HEIC/HEIF |
| Responsive Image Generator | Stabil | Output multi-width dan snippet `<picture>` |
| Batch Processing + ZIP | Stabil | Output ZIP berisi assets, snippets, reports |
| Background Remover Ringan | Stabil | Untuk latar polos; bukan AI remover |
| SVG Optimizer Ringan | Stabil | Minify dan cleanup SVG ringan |
| Raster to SVG Tracer | Eksperimental | Untuk logo/ikon/gambar sederhana |
| Video & Animation Prep | Fondasi | Belum fitur operasional penuh |
| Document & Office Prep | Fondasi | Belum fitur operasional penuh |

## Fitur Image & Vector Prep

### Image Optimizer Biasa
- Upload satu atau banyak gambar.
- Mendukung JPG, PNG, WebP, HEIC, dan HEIF.
- Resize berdasarkan width.
- Quality slider.
- Convert ke WebP/JPG/PNG.
- Responsive image generator.
- Batch ZIP.
- HTML snippet generator.

### Background Remover Ringan
- Mode tool terpisah dari Image Optimizer.
- Cocok untuk logo, ikon, stiker, atau gambar dengan background polos.
- Pilih warna background dari gambar.
- Connected area removal agar warna serupa di objek inti tidak ikut hilang.
- Compare before/after.
- Catatan preview transparansi untuk WebP/PNG.

### SVG Optimizer Ringan
- Upload SVG.
- Hapus komentar.
- Hapus metadata/editor tag.
- Pertahankan `viewBox`.
- Opsi pertahankan `title/desc`.
- Opsi pertahankan `id` untuk gradient/mask.

### Raster to SVG Tracer Eksperimental
- Trace raster sederhana menjadi SVG path.
- Preset tracing.
- Safety guard.
- Cocok hanya untuk:
  - logo sederhana;
  - ikon satu warna;
  - simbol;
  - ilustrasi flat;
  - gambar dengan sedikit warna.

Tidak disarankan untuk:
- foto kegiatan;
- foto orang;
- foto ruangan;
- screenshot aplikasi;
- banner fotografis;
- gambar kompleks.

## Cara pasang di GitHub Pages

1. Upload semua file ke repository.
2. Pastikan struktur root berisi:
   - `index.html`
   - `image.html`
   - `svg.html`
   - `tracer.html`
   - `video.html`
   - `office.html`
   - `sw.js`
   - `manifest.json`
   - folder `css`
   - folder `js`
   - folder `vendor`
   - folder `assets`
3. Aktifkan GitHub Pages dari branch utama.
4. Setelah update paket, lakukan hard refresh:
   ```text
   Ctrl + Shift + R
   ```

## Catatan cache PWA

Jika browser masih menampilkan versi lama:
1. buka DevTools;
2. Application;
3. Service Workers;
4. klik unregister;
5. Clear site data;
6. reload halaman.

## Version lock

```text
Version label : v1-R5-FINAL
App version   : 1.0.6-r5-final-image-vector
Status        : stable-v1-image-vector
```

## Tahap berikutnya

Rekomendasi lanjutan:
1. `v1-R6 — Video & Animation Prep Basic`
2. `v1-R7 — Document & Office Prep Basic`
3. `v2 — Hybrid/backend processing untuk proses berat`


## Patch v1-R5-FINAL-R1 — Landing Badge Hard Fix

Patch ini memperbaiki catatan uji bahwa landing page masih menampilkan badge versi lama.

Perbaikan:
- Badge versi di `index.html` dikunci eksplisit menjadi `v1-R5-FINAL`.
- Teks landing page diselaraskan dengan status final Image & Vector Prep.
- Status kartu Image & Vector Prep diselaraskan ke status stabil v1.
- Ditambahkan panel `Version lock: v1-R5-FINAL` di landing page.
- `sw.js`, `manifest.json`, dan `VERSION.json` diselaraskan.
- Service worker cache version dinaikkan.

Catatan penting:
- Tulisan badge di landing page dibaca dari `index.html`, bukan dari `sw.js`.
- `sw.js` hanya mengatur cache/service worker, bukan sumber teks tampilan halaman.
