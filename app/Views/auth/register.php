<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#047857">
    <title>Daftar Pasien - MedicFlow</title>
    <link rel="stylesheet" href="<?= base_url('assets/css/app.css') ?>">
</head>
<body class="auth-page">
    <main class="auth-shell register-shell">
        <section class="auth-intro">
            <a class="brand brand-light" href="<?= site_url('/') ?>">
                <span class="brand-mark">+</span>
                <span>MedicFlow</span>
            </a>
            <p class="eyebrow">PENDAFTARAN PASIEN</p>
            <h1>Buat akun untuk mengatur kunjungan Anda.</h1>
            <p class="intro-copy">Daftar antrean, pantau status pemeriksaan, dan lihat informasi resep melalui aplikasi.</p>
        </section>
        <section class="auth-card register-card">
            <div class="card-heading">
                <span class="eyebrow">AKUN BARU</span>
                <h2>Daftar sebagai pasien</h2>
                <p>Pastikan data sesuai identitas Anda.</p>
            </div>
            <form id="registerForm" class="register-form">
                <div class="form-grid">
                    <div class="field-wrap">
                        <label class="field-label" for="regName">Nama lengkap</label>
                        <input class="field" id="regName" name="nama_lengkap" required maxlength="100" autocomplete="name">
                    </div>
                    <div class="field-wrap">
                        <label class="field-label" for="regUsername">Username</label>
                        <input class="field" id="regUsername" name="username" required minlength="3" maxlength="50" pattern="[A-Za-z0-9._-]{3,50}" autocomplete="username">
                    </div>
                    <div class="field-wrap">
                        <label class="field-label" for="regPassword">Password (minimal 10 karakter)</label>
                        <input class="field" id="regPassword" name="password" type="password" required minlength="10" autocomplete="new-password">
                    </div>
                    <div class="field-wrap">
                        <label class="field-label" for="regNik">NIK (16 digit)</label>
                        <input class="field" id="regNik" name="nik" inputmode="numeric" pattern="[0-9]{16}" minlength="16" maxlength="16" required>
                    </div>
                    <div class="field-wrap">
                        <label class="field-label" for="regBirthDate">Tanggal lahir</label>
                        <input class="field" id="regBirthDate" name="tanggal_lahir" type="date" required>
                    </div>
                    <div class="field-wrap">
                        <label class="field-label" for="regGender">Jenis kelamin</label>
                        <select class="field" id="regGender" name="jenis_kelamin" required>
                            <option value="">Pilih jenis kelamin</option>
                            <option value="L">Laki-laki</option>
                            <option value="P">Perempuan</option>
                        </select>
                    </div>
                    <div class="field-wrap">
                        <label class="field-label" for="regPhone">Nomor telepon</label>
                        <input class="field" id="regPhone" name="no_telepon" type="tel" maxlength="20" required autocomplete="tel">
                    </div>
                    <div class="field-wrap">
                        <label class="field-label" for="regBpjs">Nomor BPJS <span class="optional">Opsional</span></label>
                        <input class="field" id="regBpjs" name="nomor_bpjs" maxlength="20">
                    </div>
                    <div class="field-wrap field-full">
                        <label class="field-label" for="regAddress">Alamat <span class="optional">Opsional</span></label>
                        <textarea class="field textarea" id="regAddress" name="alamat" rows="3"></textarea>
                    </div>
                </div>
                <p id="formMessage" class="form-message" role="status" aria-live="polite"></p>
                <button class="button button-primary button-wide" id="submitButton" type="submit">Buat akun pasien <span>→</span></button>
            </form>
            <p class="auth-footer">Sudah memiliki akun? <a href="<?= site_url('login') ?>">Masuk</a></p>
        </section>
    </main>
    <script>
        window.MEDICFLOW_API_BASE = <?= json_encode(rtrim(site_url('api'), '/'), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
        window.MEDICFLOW_LOGIN_URL = <?= json_encode(site_url('login'), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
        window.MEDICFLOW_APP_URL = <?= json_encode(site_url('app'), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
        window.MEDICFLOW_REGISTER_URL = <?= json_encode(site_url('register'), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
    </script>
    <script src="<?= base_url('assets/js/app.js') ?>" defer></script>
</body>
</html>
