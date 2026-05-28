# Web Asset Prep Tool v1-R5-R3-R4-R3-R2 — Redundant Checkbox Suppression & Tool Mode UX Polish

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


## Tambahan v1-R5 — Raster to SVG Tracer Eksperimental

Paket ini menambahkan modul baru:

```text
tracer.html
js/tracerApp.js
js/rasterTracer.js
```

Fungsi:
- Upload JPG, PNG, WebP, HEIC, atau HEIF.
- Trace raster sederhana menjadi SVG path/vector.
- Mode awal: monochrome threshold.
- Output SVG berbasis path.
- Preview original dan SVG hasil trace.
- Download SVG.
- Generate snippet `<img>`.

Gunakan hanya untuk:
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

Catatan teknis:
- Semakin besar `Lebar tracing`, semakin detail hasilnya, tetapi file SVG bisa menjadi besar dan berat.
- Jika laporan menunjukkan path segment terlalu banyak, gunakan WebP/JPG/PNG dari Image Tool.
- Ini adalah tracer eksperimental berbasis browser, bukan pengganti vectorizer profesional.


## Perbaikan v1-R5-R1 — Trace Width Slider UX

Paket ini memoles modul Raster to SVG Tracer berdasarkan hasil uji awal.

Perbaikan:
- Kontrol `Lebar tracing` diubah dari input angka menjadi slider.
- Angka lebar tracing tampil langsung di sisi kanan slider.
- Slider memakai rentang:
  ```text
  64 px sampai 1024 px
  step 16 px
  default 256 px
  ```
- Service worker cache version dinaikkan.

Catatan:
- Lebar tracing besar menghasilkan SVG lebih detail, tetapi path segment dan ukuran file bisa membesar.
- Untuk ikon/logo sederhana, mulai dari 256 px atau 384 px.
- Untuk logo yang lebih besar, 512 px sering cukup.
- 1024 px hanya untuk uji detail, bukan default yang disarankan.


## Perbaikan v1-R5-R2 — Raster Tracer Preset, Safety Guard & Output Quality Polish

Paket ini memoles modul Raster to SVG Tracer agar lebih aman untuk pengguna awam.

Tambahan:
- Preset tracing:
  ```text
  Ikon sederhana
  Logo sederhana
  Ilustrasi flat
  Detail tinggi
  Custom/manual
  ```
- Tombol `Gunakan setting aman`.
- Safety guard real-time berdasarkan lebar tracing.
- Safety guard hasil berdasarkan:
  - jumlah path segment,
  - ukuran SVG,
  - rasio SVG terhadap file asli,
  - estimasi variasi warna,
  - kepadatan pixel aktif.
- Laporan tracing lebih rinci.
- Rekomendasi hasil:
  ```text
  Cocok untuk SVG
  Perlu cek visual
  Tidak disarankan
  ```

Catatan:
- Jika status `Tidak disarankan`, gunakan Image Tool dan output WebP/JPG/PNG.
- Jika status `Perlu cek visual`, bandingkan hasil SVG dengan WebP dari Image Tool.
- Raster to SVG tetap eksperimental dan sebaiknya hanya untuk logo/ikon/ilustrasi sederhana.


## Tambahan v1-R5-R3 — Image Background Remover Ringan

Paket ini menambahkan fitur hapus background ringan pada `image.html`.

Fitur:
- Aktifkan hapus background pada Image Tool.
- Auto deteksi warna background dari sudut gambar.
- Pilih warna background manual.
- Tolerance slider.
- Edge softness slider.
- Output transparan PNG/WebP.
- Jika output JPG dipilih saat background remover aktif, sistem otomatis memakai PNG agar transparansi tidak hilang.
- Preview output tetap memakai checkerboard.
- Laporan detail:
  - warna target,
  - tolerance,
  - edge softness,
  - jumlah pixel transparan,
  - jumlah pixel soft edge.

Cocok untuk:
- logo dengan background putih/polos;
- ikon;
- stiker;
- gambar produk sederhana;
- asset organisasi dengan latar seragam.

Tidak cocok untuk:
- foto orang dengan rambut/detail halus;
- foto kegiatan;
- background ramai;
- gambar dengan bayangan kompleks.

Catatan:
- Ini bukan AI background remover.
- Untuk objek kompleks, gunakan tool desain khusus atau backend/AI module pada versi lanjutan.


## Perbaikan v1-R5-R3-R1 — Background Remover Reprocess & Reset Setting Fix

Paket ini memperbaiki dua catatan hasil uji v1-R5-R3.

Perbaikan:
- File yang sudah selesai diproses sekarang bisa diproses ulang setelah nilai tolerance, edge softness, output format, width, quality, atau opsi lain diubah.
- Tombol `Reset` pada Image Tool diubah menjadi `Reset setting`.
- `Reset setting` tidak lagi menghapus file yang sudah diupload.
- Reset hanya mengembalikan nilai setting ke default, membersihkan output/laporan/snippet, dan mempertahankan file original.
- File bisa diproses ulang tanpa perlu upload ulang.

Catatan:
- Untuk mengganti file, pilih/upload file baru dari area upload.
- Saat background remover aktif dan output JPG dipilih, sistem tetap memaksa output PNG agar transparansi tidak hilang.


## Perbaikan v1-R5-R3-R4 — Connected Area Background Remover

Paket ini memperbaiki kasus ketika warna background yang dipilih juga muncul di objek utama.

Tambahan:
- Opsi `Hapus hanya area tersambung dari titik/sudut background`.
- Jika user memakai `Ambil dari gambar`, titik klik disimpan sebagai seed area background.
- Background remover hanya menghapus warna mirip yang tersambung dari seed tersebut.
- Warna serupa di dalam objek utama tidak ikut terhapus jika tidak tersambung ke area background.
- Mode auto memakai seed dari empat sudut gambar.
- Laporan detail menampilkan mode area hapus dan titik seed.

Catatan:
- Cocok untuk logo/lencana dengan latar luar bidang tertentu, misalnya luar lingkaran/perisai.
- Jika ada beberapa area background yang terpisah, klik area yang ingin dihapus atau nonaktifkan opsi area tersambung untuk mode global.
- Untuk objek/foto kompleks, fitur ini tetap bukan AI background remover.


## Perbaikan v1-R5-R3-R4-R1 — Compare Placeholder Hide & Direction Label Fix

Paket ini memperbaiki catatan uji pada fitur Compare before/after.

Perbaikan:
- Placeholder compare disembunyikan otomatis setelah original dan output tersedia.
- Area compare diberi label visual `Original` dan `Output`.
- Slider compare diperjelas sebagai before/after wipe.
- Service worker cache version dinaikkan.

Catatan:
- Compare memakai original sebagai base layer.
- Output ditampilkan sebagai overlay yang dibuka mengikuti posisi slider.
- Label membantu membaca area mana yang sedang dilihat.


## Perbaikan v1-R5-R3-R4-R2 — Compare Helper Text Alignment & Transparency Preview Note

Paket ini memperbaiki catatan uji pada compare before/after dan preview transparansi.

Perbaikan:
- Teks bantuan compare disesuaikan menjadi:
  `Kiri: output · kanan: original`.
- Ringkasan export menambahkan catatan preview transparansi.
- Laporan menampilkan label `Transparansi aktif` bila background remover aktif dan output memakai WebP/PNG.
- Catatan bahwa image viewer tertentu dapat menampilkan area transparan sebagai latar hitam.
- Service worker cache version dinaikkan.

Catatan:
- Untuk validasi transparansi, cek output di browser, editor gambar, atau halaman web yang mendukung transparansi WebP/PNG.


## Perbaikan v1-R5-R3-R4-R3 — Image Tool Mode Separation

Paket ini memisahkan mode kerja di `image.html` agar pengguna tidak bingung antara Image Optimizer biasa dan Background Remover Ringan.

Perubahan:
- Tambah pilihan tool:
  - `Image Optimizer Biasa`
  - `Background Remover Ringan`
- Saat `Image Optimizer Biasa` dipilih:
  - panel Background Remover disembunyikan;
  - Compare before/after disembunyikan;
  - proses resize/convert/responsive/batch tetap berjalan seperti biasa.
- Saat `Background Remover Ringan` dipilih:
  - panel hapus background tampil;
  - compare before/after tampil;
  - fitur color picker dan connected area tetap aktif.
- Reset setting mengembalikan mode ke `Image Optimizer Biasa`.
- Service worker cache version dinaikkan.

Catatan:
- Preview original/output tetap dipertahankan untuk kedua mode karena masih dibutuhkan untuk memeriksa hasil optimasi gambar.
- Detail hapus background hanya muncul bila Background Remover aktif dan output memiliki data hapus background.


## Perbaikan v1-R5-R3-R4-R3-R1 — Tool Mode Visible Fix

Paket ini memperbaiki catatan uji bahwa pilihan tool belum tampil pada Image Tool.

Perbaikan:
- Panel `Pilih tool` disisipkan ulang secara eksplisit pada bagian `Atur output`.
- Pilihan tool tampil sebelum field preset/output.
- Mode `Image Optimizer Biasa` tetap menjadi default.
- Mode `Background Remover Ringan` menampilkan panel hapus background dan compare before/after.
- Panel Background Remover dan Compare tetap disembunyikan saat mode Image Optimizer Biasa aktif.
- Service worker cache version dinaikkan.


## Perbaikan v1-R5-R3-R4-R3-R2 — Redundant Checkbox Suppression & Tool Mode UX Polish

Paket ini memoles pemisahan mode kerja pada `Image Tool`.

Perubahan:
- Checkbox `Aktifkan hapus background` tidak lagi ditampilkan sebagai pilihan manual.
- Di mode `Background Remover Ringan`, panel menampilkan status:
  `Background Remover Aktif`.
- Mode tool sekarang menjadi pengendali utama:
  - `Image Optimizer Biasa` = resize/convert/responsive/batch tanpa panel hapus background.
  - `Background Remover Ringan` = hapus background aktif, color picker aktif, connected area aktif, compare aktif.
- Teks bantuan pilihan tool dipoles agar lebih jelas.
- Landing page version badge diselaraskan dengan versi paket terbaru.
- Service worker cache version dinaikkan.

Catatan:
- Input checkbox tetap dipertahankan secara hidden untuk kompatibilitas internal JavaScript.
- Pengguna tidak perlu lagi mencentang background remover secara terpisah setelah memilih mode `Background Remover Ringan`.
