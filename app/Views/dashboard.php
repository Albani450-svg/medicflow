<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#047857">
    <title>Dashboard - MedicFlow</title>
    <link rel="stylesheet" href="<?= esc(parse_url(base_url('assets/css/app.css'), PHP_URL_PATH)) ?>">
</head>
<body class="app-page">
    <div class="app-shell">
        <aside class="sidebar">
            <a class="brand" href="<?= esc(parse_url(site_url('app'), PHP_URL_PATH)) ?>">
                <span class="brand-mark">+</span>
                <span>MedicFlow</span>
            </a>
            <div class="sidebar-caption">MENU UTAMA</div>
            <nav id="sideNavigation" class="side-navigation" aria-label="Navigasi dashboard"></nav>
            <div class="sidebar-footer">
                <div class="user-avatar" id="userAvatar">M</div>
                <div class="user-summary">
                    <strong id="userName">Memuat akun...</strong>
                    <span id="userRole">MedicFlow</span>
                </div>
                <button class="icon-button" id="logoutButton" type="button" aria-label="Keluar">↪</button>
            </div>
        </aside>
        <main class="main-area">
            <header class="topbar">
                <div>
                    <p class="eyebrow">MEDICFLOW / <span id="topRole">DASHBOARD</span></p>
                    <h1 id="pageTitle">Dashboard</h1>
                </div>
                <div class="topbar-date" id="todayLabel"></div>
            </header>
            <div class="content-area">
                <div id="toast" class="toast" role="status" aria-live="polite"></div>
                <section id="dashboardContent" aria-live="polite">
                    <div class="loading-card"><span class="spinner"></span> Memuat data dashboard...</div>
                </section>
            </div>
        </main>
    </div>
    <script>
        window.MEDICFLOW_API_BASE = <?= json_encode(rtrim(parse_url(site_url('api'), PHP_URL_PATH), '/'), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
        window.MEDICFLOW_LOGIN_URL = <?= json_encode(parse_url(site_url('login'), PHP_URL_PATH), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
        window.MEDICFLOW_APP_URL = <?= json_encode(parse_url(site_url('app'), PHP_URL_PATH), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
        window.MEDICFLOW_REGISTER_URL = <?= json_encode(parse_url(site_url('register'), PHP_URL_PATH), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;
    </script>
    <script src="<?= esc(parse_url(base_url('assets/vendor/html5-qrcode.min.js'), PHP_URL_PATH)) ?>" defer></script>
    <script src="<?= esc(parse_url(base_url('assets/js/core.js'), PHP_URL_PATH)) ?>" defer></script>
    <script src="<?= esc(parse_url(base_url('assets/js/views/common.js'), PHP_URL_PATH)) ?>" defer></script>
    <script src="<?= esc(parse_url(base_url('assets/js/views/patient.js'), PHP_URL_PATH)) ?>" defer></script>
    <script src="<?= esc(parse_url(base_url('assets/js/views/doctor.js'), PHP_URL_PATH)) ?>" defer></script>
    <script src="<?= esc(parse_url(base_url('assets/js/views/nurse.js'), PHP_URL_PATH)) ?>" defer></script>
    <script src="<?= esc(parse_url(base_url('assets/js/views/pharmacy.js'), PHP_URL_PATH)) ?>" defer></script>
    <script src="<?= esc(parse_url(base_url('assets/js/views/admin.js'), PHP_URL_PATH)) ?>" defer></script>
    <script src="<?= esc(parse_url(base_url('assets/js/dashboard.js'), PHP_URL_PATH)) ?>" defer></script>
    <script src="<?= esc(parse_url(base_url('assets/js/app.js'), PHP_URL_PATH)) ?>" defer></script>
</body>
</html>
