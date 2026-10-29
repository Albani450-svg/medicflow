# CodeIgniter 4 Application Starter

## What is CodeIgniter?

CodeIgniter is a PHP full-stack web framework that is light, fast, flexible and secure.
More information can be found at the [official site](https://codeigniter.com).

This repository holds a composer-installable app starter.
It has been built from the
[development repository](https://github.com/codeigniter4/CodeIgniter4).

More information about the plans for version 4 can be found in [CodeIgniter 4](https://forum.codeigniter.com/forumdisplay.php?fid=28) on the forums.

You can read the [user guide](https://codeigniter.com/user_guide/)
corresponding to the latest version of the framework.

## Installation & updates

`composer create-project codeigniter4/appstarter` then `composer update` whenever
there is a new release of the framework.

When updating, check the release notes to see if there are any changes you might need to apply
to your `app` folder. The affected files can be copied or merged from
`vendor/codeigniter4/framework/app`.

## Setup

Copy `env` to `.env` and tailor for your app, specifically the baseURL
and any database settings.

## API authentication

Protected API routes require a JWT issued by `POST /api/auth/login`. Login uses
an active account of any role and verifies its `password_hash` with PHP's
`password_verify()`. Send the returned token in the HTTP `Authorization` header
using the `Bearer` scheme when calling patient API routes. Tokens expire after
one hour.

Set `JWT_SECRET` in `.env` to a randomly generated value of at least 32
characters. For example, generate one with
`php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"`. Do not commit the secret.

Patient registration is available at `POST /api/auth/register`; it creates a
patient account only. Login at `POST /api/auth/login` accepts any active role.
Use the returned token as `Authorization: Bearer <token>`.

Role-specific API routes:

- Patients: `/api/pasien/me`, `/api/pasien/pendaftaran`,
  `/api/pasien/pemeriksaan`, `/api/pasien/resep`, and
  `/api/pasien/notifikasi`.
- Doctors: `/api/dokter/antrian`, `/api/dokter/jadwal`,
  `/api/dokter/pemeriksaan`, and `/api/dokter/resep`.
- Nurses: `GET /api/perawat/antrian` lists patients waiting for initial checks;
  `POST /api/perawat/antrian/{id}/triase` records the initial assessment.
- Pharmacy: `/api/farmasi/obat`, `/api/farmasi/resep`,
  `/api/farmasi/mutasi-stok`, and `/api/farmasi/pengambilan-obat`.
- Admin: CRUD resources under `/api/admin/`.

The patient registration JSON requires `username`, `password` (at least 10
characters), `nama_lengkap`, `nik` (16 digits), `tanggal_lahir` (`YYYY-MM-DD`),
`jenis_kelamin` (`L` or `P`), and `no_telepon`. `alamat` and `nomor_bpjs` are
optional. To register an appointment, send `id_jadwal` and
`tanggal_kunjungan` (`YYYY-MM-DD`) to `POST /api/pasien/pendaftaran`.

Nurses record the patient's initial complaint, blood pressure, temperature,
weight, height, and optional nursing note. Saving the assessment changes the
appointment status from `Menunggu` to `Siap Diperiksa`. Doctors can then call
the patient, review the nurse's notes in their queue and examination form, and
continue with diagnosis and treatment. The patient is not marked ready for the
doctor until the nurse's assessment has been saved.

Run `php spark migrate` after updating the application to add the nurse role,
the `Siap Diperiksa` queue status, and the `triase_perawat` table. Back up the
database before applying schema migrations.

Doctors create schedules using `hari`, `jam_mulai`, `jam_selesai`, and
`kuota_maksimal`. An examination requires `id_pendaftaran`, `keluhan`,
`diagnosis`, and `tindakan`; prescriptions are created with
`id_pendaftaran` and a `detail` array containing `id_obat`, `jumlah`, and
`dosis_aturan_pakai`.

The doctor dashboard combines the examination and optional prescription in one
submission. When a medicine is selected, provide its quantity and directions;
the examination and the in-house pharmacy prescription are saved together, and
the prescription appears immediately in the pharmacy queue. A prescription is
optional when no medicine is needed. Changing an eligible appointment to
`Dipanggil` records a `Pasien Dipanggil` web notification. An open patient
dashboard checks for new appointment and notification updates every 10 seconds;
this is an in-app notification, not an SMS, WhatsApp message, or guaranteed
browser push when the patient is offline.

Run `php spark migrate` to enable the `Pasien Dipanggil` notification type.

Pharmacy records stock changes at `POST /api/farmasi/mutasi-stok` with
`id_obat`, `jumlah`, and `jenis_mutasi` (`Masuk`, `Keluar`, or `Penyesuaian`).
Set a prescription to `Sedang Diracik` and then `Siap Diambil`; the API
decreases stock when preparation starts. At pickup, submit `id_resep`,
`kode_qr_unik`, `diambil_oleh`, and `metode_verifikasi: "QR"`.

The public `GET /api/jadwal-dokter` route lists active practice schedules.
Notifications are web/PWA only: all new notification records use the PWA
channel, and pharmacy creates one when an in-house prescription is ready.
WhatsApp delivery is disabled. Pickup currently requires QR verification;
PIN and OTP verification are not enabled.

## Web application

The web interface is served by CodeIgniter at `/login`, `/register`, and
`/app`; `/` redirects to the login page. Patient self-registration is available from the login screen. Log in using
your account username and password; the server determines the role from the
authenticated account and opens its dashboard automatically, without a role
selector. An account ID or username alone cannot log in. Staff and administrator
accounts must be created by an administrator. After login, the interface
displays navigation and actions for the authenticated role and calls the
protected JSON API.

The patient interface supports appointment registration, visit and examination
history, prescription choices, profile updates, and web notifications. Nurses
record the initial complaint and vital signs before the doctor calls the patient.
Doctors can manage their own practice schedules, queue, examinations, and
prescriptions. Pharmacy staff can manage the medicine catalog and stock
movements, process prescriptions, and record QR-verified pickups. Administrators
can manage the operational resources exposed under `/api/admin/`.

The access token is held in browser `sessionStorage` and cleared on logout or
when the API rejects an expired session. The frontend is served from
`public/assets/`; no WhatsApp integration is used.

When an in-house prescription becomes ready, the patient can request a private
QR image from the authenticated prescription page. Pharmacy scans it using the
device camera, reviews the patient and medicine details, and explicitly
confirms handover. The QR contains only a random verification token; it is not
available before the prescription is ready. Camera access requires HTTPS or
localhost and permission from the browser. The scanner library is bundled
locally under `public/assets/vendor/` and does not send QR data to a third party.

### Local test accounts

In a development or testing environment, run
`php spark db:seed MedicFlowDemoSeeder` to add demo accounts, a doctor profile,
a future Monday schedule, and a patient appointment. The seeder is idempotent
and refuses to run in production. All demo accounts use the password
`MedicFlowDemo#2026`:

| Role | Username |
| --- | --- |
| Admin | `demo_admin` |
| Dokter | `demo_dokter` |
| Perawat | `demo_perawat` |
| Farmasi | `demo_farmasi` |
| Pasien | `demo_pasien` |

Use the admin dashboard's **Akun staf** page to review admin, doctor, nurse,
and pharmacy accounts. The demo patient appointment starts in **Menunggu** so
the nurse can record the initial assessment before the doctor practices the
queue, examination, and prescription flow. Re-running the seeder selects a new
future demo visit if the previous one has already been completed. These shared
demo credentials are for local testing only; do not use them in a deployed
environment.

## Important Change with index.php

`index.php` is no longer in the root of the project! It has been moved inside the *public* folder,
for better security and separation of components.

This means that you should configure your web server to "point" to your project's *public* folder, and
not to the project root. A better practice would be to configure a virtual host to point there. A poor practice would be to point your web server to the project root and expect to enter *public/...*, as the rest of your logic and the
framework are exposed.

**Please** read the user guide for a better explanation of how CI4 works!

## Repository Management

We use GitHub issues, in our main repository, to track **BUGS** and to track approved **DEVELOPMENT** work packages.
We use our [forum](http://forum.codeigniter.com) to provide SUPPORT and to discuss
FEATURE REQUESTS.

This repository is a "distribution" one, built by our release preparation script.
Problems with it can be raised on our forum, or as issues in the main repository.

## Server Requirements

PHP version 8.1 or higher is required, with the following extensions installed:

- [intl](http://php.net/manual/en/intl.requirements.php)
- [mbstring](http://php.net/manual/en/mbstring.installation.php)

> [!WARNING]
> - The end of life date for PHP 7.4 was November 28, 2022.
> - The end of life date for PHP 8.0 was November 26, 2023.
> - If you are still using PHP 7.4 or 8.0, you should upgrade immediately.
> - The end of life date for PHP 8.1 will be December 31, 2025.

Additionally, make sure that the following extensions are enabled in your PHP:

- json (enabled by default - don't turn it off)
- [mysqlnd](http://php.net/manual/en/mysqlnd.install.php) if you plan to use MySQL
- [libcurl](http://php.net/manual/en/curl.requirements.php) if you plan to use the HTTP\CURLRequest library
