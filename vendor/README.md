# Optional local HEIC decoder

Untuk dukungan HEIC/HEIF yang benar-benar offline, simpan file berikut di folder ini:

```text
vendor/heic2any.min.js
```

Aplikasi mencoba memuat file lokal tersebut terlebih dahulu.

Jika file lokal tidak ada, aplikasi akan mencoba memuat `heic2any` dari CDN saat pertama kali memproses HEIC/HEIF. Untuk penggunaan internal/offline penuh, lebih baik simpan library secara lokal.
