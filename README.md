```markdown
# MedicFlow - Platform Manajemen Klinik

**MedicFlow** adalah sistem manajemen klinik berbasis web yang dirancang untuk mengotomatisasi dan menyederhanakan alur operasional layanan kesehatan secara terintegrasi. Aplikasi ini dibangun menggunakan framework **CodeIgniter 4** dengan arsitektur **RESTful API**, yang memastikan pengelolaan data berjalan cepat, aman, dan terstruktur.

Melalui MedicFlow, seluruh tahapan layanan medis—mulai dari pendaftaran pasien, pemeriksaan awal oleh perawat, konsultasi dengan dokter, hingga penebusan obat di bagian farmasi—dapat dikelola dalam satu sistem terpusat.

---

## 🚀 Fitur Utama

- **Multi-User Access Control (RBAC):** Hak akses terpisah sesuai dengan peran operasional di klinik (Admin, Pasien, Perawat, Dokter, dan Farmasi).
- **RESTful API Backend:** Arsitektur backend berbasis API Controller untuk pemrosesan data CRUD yang cepat dan terstruktur.
- **Manajemen Pasien & Rekam Medis:** Pengelolaan pendaftaran pasien, pencatatan riwayat medis, dan konsultasi dokter.
- **Layanan Farmasi & Obat:** Integrasi resep obat dari dokter langsung ke bagian farmasi/apotek.
- **Antarmuka Responsif:** Tampilan yang ramah pengguna dan mudah diakses dari berbagai perangkat.

---

## 🛠️ Teknologi yang Digunakan

- **Backend Framework:** CodeIgniter 4 (PHP)
- **Database:** PostgreSQL / MySQL
- **Architecture:** RESTful API & MVC Pattern
- **Frontend:** HTML, CSS, JavaScript, Bootstrap

---

## 👥 Peran Pengguna (Roles)

MedicFlow membagi hak akses ke dalam 5 peran utama agar setiap staf klinik dapat bekerja sesuai dengan tanggung jawabnya masing-masing:
* **Admin:** Mengelola keseluruhan sistem, konfigurasi, dan data pengguna klinik.
* **Pasien:** Melakukan pendaftaran mandiri dan memantau riwayat kunjungan serta rekam medis.
* **Perawat:** Melakukan asesmen awal pasien (pemeriksaan tanda vital) dan mendukung tugas klinis dokter.
* **Dokter:** Melakukan pemeriksaan, mengisi rekam medis, dan memberikan resep obat.
* **Farmasi:** Menerima, memvalidasi, dan menyiapkan resep obat yang diberikan oleh dokter.

---

## 🔑 Akun Demo (Demo Credentials)

Anda dapat menggunakan akun-akun berikut untuk mencoba masuk (*login*) ke dalam sistem dan menguji berbagai fitur di MedicFlow[cite: 1]:

| Role / Peran | Username |
| :--- | :--- |
| **Admin** | `demo_admin`[cite: 1] |
| **Pasien** | `demo_pasien`[cite: 1] |
| **Perawat** | `demo_perawat`[cite: 1] |
| **Dokter** | `demo_dokter`[cite: 1] |
| **Farmasi** | `demo_farmasi`[cite: 1] |

> **Password untuk semua akun:** `MedicFlowDemo#2026`[cite: 1]

---

## 💻 Cara Instalasi & Menjalankan secara Lokal

### Prasyarat
Pastikan komputer/laptop Anda telah menginstal:
- **PHP** `>= 8.1`
- **Composer**
- **Database Engine** (MySQL / PostgreSQL)
- **Web Server** (Apache / Nginx / Laragon / XAMPP)

### Langkah-langkah Instalasi

1. **Clone Repository**
   ```bash
   git clone [https://github.com/fawwazhaji/medicflow.git](https://github.com/fawwazhaji/medicflow.git)
   cd medicflow

```

2. **Install Dependensi Composer**
```bash
composer install

```


3. **Konfigurasi Environment (`.env`)**
Duplikat file `env` menjadi `.env` dan sesuaikan konfigurasi database Anda:
```env
CI_ENVIRONMENT = development

database.default.hostname = localhost
database.default.database = nama_database_anda
database.default.username = root
database.default.password = 
database.default.DBDriver = MySQLi  # Atau Postgre jika menggunakan PostgreSQL

```


4. **Jalankan Migration & Seeder**
```bash
php spark migrate
php spark db:seed AdminSeeder

```


5. **Jalankan Server Lokal**
```bash
php spark serve

```

Aplikasi dapat diakses melalui browser di alamat: `http://localhost:8080`

---

## 📄 Lisensi

Proyek ini dikembangkan untuk kebutuhan manajemen klinik dan didistribusikan di bawah lisensi Open Source.
