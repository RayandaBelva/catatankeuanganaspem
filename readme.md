# Catatan Keuangan Perjalanan Dinas

Versi ini menggunakan HTML, CSS, JavaScript Vanilla, dan **localStorage saja**.

## Cara menjalankan
1. Buka folder ini di VS Code.
2. Buka `index.html` dengan **Live Server**, atau klik dua kali `index.html`.
3. Login menggunakan akun awal:
   - Username: `admin`
   - Password: `admin123`

## Fitur
- Login setiap orang.
- Admin dapat menambah/mengubah/menghapus orang.
- Membuat perjalanan dinas terpisah.
- Memilih peserta untuk setiap perjalanan.
- Pemasukan dan pengeluaran tersimpan berdasarkan perjalanan.
- Setiap transaksi otomatis dihitung porsinya berdasarkan jumlah peserta.
- **Foto struk per transaksi**: setiap transaksi bisa dilampiri foto struk. Jika tidak ada struk, kolom Keterangan wajib diisi sebagai gantinya.
- **Rekap "Dapat" per orang per perjalanan**: setiap peserta punya nilai "Dapat" (porsi pemasukan − porsi pengeluaran) di tiap perjalanan, ditotal juga di halaman Laporan untuk seluruh perjalanan.
- **Pencatatan pembayaran**: nilai "Dapat" bisa dikurangi dengan mencatat pembayaran (jumlah, tanggal, keterangan) yang **wajib disertai foto bukti tanda tangan berformat PNG**. Sisa yang belum dibayar otomatis terhitung, dan riwayat pembayaran (dengan thumbnail bukti) tersimpan di halaman Detail perjalanan.
- Laporan per orang.
- Data tersimpan di browser melalui localStorage.
- Tidak membutuhkan Node.js, database, atau backend.

## Cara pakai fitur baru
1. **Tambah transaksi dengan struk**: buka Detail perjalanan → "+ Tambah" → isi form → unggah "Foto Struk", atau kosongkan foto lalu isi "Keterangan".
2. **Catat pembayaran**: buka Detail perjalanan → pada tabel "Dapat & Pembayaran per Orang" klik tombol **Bayar** di baris orang yang dibayar → isi jumlah, tanggal, keterangan → unggah **foto bukti tanda tangan (harus .png)** → Simpan. Sisa akan otomatis berkurang, dan riwayatnya muncul di bawah tabel.
3. **Lihat total per orang**: buka tab Laporan. Pilih "Semua Perjalanan" untuk melihat total Dapat / Sudah Dibayar / Sisa akumulasi seluruh perjalanan, atau pilih satu perjalanan untuk melihat rekapnya saja.

## Catatan localStorage
Data hanya tersimpan pada browser/perangkat tempat aplikasi digunakan. Login ini cocok untuk prototipe atau penggunaan lokal, bukan sistem multi-perangkat yang membutuhkan sinkronisasi.
