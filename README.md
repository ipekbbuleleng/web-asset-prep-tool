# Web Asset Prep Tool v1-R4-R1 — Landing Page Portal 3 Modul

PWA lokal tanpa backend untuk menyiapkan aset gambar sebelum digunakan pada aplikasi web, PWA, landing page, dashboard, portal publik, atau sistem internal.

## Fitur v1-R3

- Upload banyak file sekaligus.
- Input JPG, PNG, WebP, HEIC, dan HEIF.
- Batch queue/list dengan status per file.
- Preview file pertama.
- Batch single output:
  - contoh: banyak foto → masing-masing menjadi `nama-file-kegiatan-1200.webp`.
- Batch responsive output:
  - contoh: banyak foto → masing-masing menjadi `480/800/1200/1600`.
- HEIC/HEIF tetap dikonversi lokal di browser melalui adapter `heic2any`.
- Generate HTML snippet per file.
- Copy semua snippet sekaligus.
- Laporan batch:
  - jumlah input,
  - jumlah output,
  - total ukuran asli,
  - total ukuran output,
  - penghematan total,
  - detail status per file.
- Download output dalam ZIP.
- PWA static, siap host di GitHub Pages.

## Catatan kapasitas

Paket ini membatasi batch maksimal 30 file per proses agar browser tidak terlalu berat.

Untuk perangkat dengan RAM terbatas, lebih aman memproses:
- 5–10 foto HEIC besar per batch;
- atau 10–20 JPG/WebP standar per batch.

## Cara pakai batch single output

1. Upload beberapa foto.
2. Pilih preset, misalnya `Foto Kegiatan — 1200 WebP q80`.
3. Klik **Proses gambar**.
4. Hasil akan menjadi file output per gambar.
5. Klik **Download hasil** untuk mendapatkan ZIP.

## Cara pakai batch responsive

1. Upload beberapa foto.
2. Pilih preset `Hero Landing Page — responsive 480/800/1200/1600`.
3. Atur daftar width bila perlu.
4. Klik **Proses gambar**.
5. Setiap foto akan menghasilkan beberapa varian responsive.
6. Klik **Download hasil** untuk mendapatkan ZIP.
7. Copy snippet untuk dipasang ke repository.

## Penamaan file

Pada batch, field **Nama file output / suffix batch** diperlakukan sebagai suffix.

Contoh:
- file asli: `foto-kegiatan.heic`
- suffix: `hero`
- width: `480, 800, 1200`

Output:
```text
foto-kegiatan-hero-480.webp
foto-kegiatan-hero-800.webp
foto-kegiatan-hero-1200.webp
```

## Struktur

```text
web-asset-prep-tool-v1-r3-batch/
  index.html
  manifest.json
  sw.js
  README.md
  css/
    app.css
  js/
    app.js
    imageProcessor.js
    heicAdapter.js
    downloadHelper.js
    reportHelper.js
  vendor/
    README.md
    heic2any.min.js  # opsional untuk HEIC offline penuh
  assets/
    icons/
      icon.svg
      icon-192.png
      icon-512.png
```

## Dukungan HEIC/HEIF

HEIC/HEIF tidak diproses langsung oleh canvas browser seperti JPG/PNG/WebP. Aplikasi memakai adapter:

1. HEIC/HEIF dibaca oleh decoder `heic2any`.
2. File dikonversi sementara menjadi JPEG di browser.
3. JPEG sementara diproses lagi oleh canvas menjadi output WebP/JPG/PNG sesuai pilihan pengguna.

Untuk mode offline penuh, simpan `heic2any.min.js` di:

```text
vendor/heic2any.min.js
```

Jika file lokal tidak tersedia, aplikasi akan mencoba memuat library dari CDN saat pertama kali memproses HEIC/HEIF.


## Perbaikan v1-R3-R1

Paket ini memoles batch yang sudah berhasil di v1-R3.

Perbaikan:
- ZIP output lebih rapi.
- ZIP sekarang berisi struktur:
  ```text
  assets/images/
  snippets/all-snippets.html
  snippets/per-file/
  reports/asset-report.json
  reports/asset-report.csv
  ```
- Tombol copy snippet per file ditambahkan di tabel batch.
- Tombol copy utama tetap menyalin semua snippet.
- Laporan ZIP menyertakan JSON dan CSV agar hasil optimasi lebih mudah diaudit.
- Progress text dibuat lebih informatif.
- Service worker cache version dinaikkan.

## Belum masuk v1-R3-R1

SVG optimizer ringan belum masuk paket ini. Fitur tersebut lebih tepat dibuat sebagai paket terpisah: `v1-R4 — SVG Optimizer Ringan`.


## Tambahan v1-R4 — SVG Optimizer Ringan

Paket ini menambahkan modul baru `svg.html` dalam aplikasi yang sama.

Fitur SVG:
- Upload satu atau banyak file `.svg`.
- Preview SVG original.
- Optimasi ringan.
- Hapus komentar.
- Hapus metadata/editor tag.
- Minify whitespace dasar.
- Pertahankan `viewBox`.
- Opsi pertahankan `title` dan `desc`.
- Opsi pertahankan `id` untuk gradient/mask.
- Membersihkan script, event handler, dan javascript URL sebagai keamanan dasar.
- Output tetap `.svg`.
- Snippet HTML berupa tag `<img>`.
- Download satu SVG atau ZIP batch SVG.

Catatan:
- Modul ini adalah optimizer SVG ringan berbasis browser.
- Untuk optimasi SVG kompleks setara SVGO penuh, versi hybrid/backend tetap lebih ideal.
- Jangan menonaktifkan opsi pertahankan `id` jika SVG memakai gradient, mask, clipPath, symbol, atau referensi `url(#id)`.


## Tambahan v1-R4-R1 — Landing Page Portal 3 Modul

Paket ini mengubah halaman awal menjadi portal modul agar aplikasi tidak langsung memuat semua fitur.

Struktur halaman:
```text
index.html   = landing page / portal utama
image.html   = Image & Vector Prep
svg.html     = SVG Optimizer Ringan
video.html   = fondasi Video & Animation Prep
office.html  = fondasi Document & Office Prep
```

Tujuan:
- landing page lebih ringan;
- modul besar dibuka sesuai kebutuhan;
- arsitektur siap berkembang ke video, animasi, PDF, DOCX, XLSX, OCR, dan backend hybrid;
- image tool yang sudah stabil tetap dipertahankan di `image.html`;
- SVG optimizer tetap dipertahankan di `svg.html`.

Catatan:
- `video.html` dan `office.html` pada paket ini masih berupa fondasi/placeholder.
- Pemrosesan video dan dokumen akan ditambahkan pada paket berikutnya secara bertahap.
