(function () {
    "use strict";

    const apiBase = window.MEDICFLOW_API_BASE || "/api";
    const tokenKey = "medicflow_access_token";
    const userKey = "medicflow_user";
    const roleLabels = { pasien: "Pasien", dokter: "Dokter", perawat: "Perawat", farmasi: "Farmasi", admin: "Administrator" };
    const roleMenus = {
        pasien: [
            ["overview", "⌂", "Ringkasan"],
            ["appointments", "▦", "Antrean & jadwal"],
            ["examinations", "♡", "Riwayat pemeriksaan"],
            ["prescriptions", "▤", "Resep obat"],
            ["notifications", "◉", "Notifikasi"],
            ["profile", "◌", "Profil saya"]
        ],
        dokter: [
            ["overview", "⌂", "Ringkasan"],
            ["queue", "▦", "Daftar pasien"],
            ["schedules", "◷", "Jadwal praktik"],
            ["examinations", "♡", "Pemeriksaan"]
        ],
        perawat: [
            ["overview", "⌂", "Ringkasan"],
            ["triage", "♡", "Pemeriksaan awal"]
        ],
        farmasi: [
            ["overview", "⌂", "Ringkasan"],
            ["prescriptions", "▤", "Antrean resep"],
            ["medicines", "✚", "Katalog obat"],
            ["stock", "▥", "Stok & mutasi"],
            ["pickup", "✓", "Pengambilan"]
        ],
        admin: [
            ["overview", "⌂", "Ringkasan"],
            ["staff", "♙", "Akun staf"],
            ["resources", "▦", "Kelola data"]
        ]
    };
    let qrScanner = null;
    let cameraScanning = false;

    function escapeHtml(value) {
        return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
        });
    }

    function formatDate(value) {
        if (!value) return "—";
        const date = new Date(String(value).slice(0, 10) + "T00:00:00");
        return Number.isNaN(date.getTime()) ? escapeHtml(value) : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
    }

    function formatDateTime(value) {
        if (!value) return "—";
        const date = new Date(String(value).replace(" ", "T"));
        return Number.isNaN(date.getTime()) ? escapeHtml(value) : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
    }

    function showToast(message, isError) {
        const toast = document.getElementById("toast");
        if (!toast) return;
        toast.textContent = message;
        toast.className = "toast visible" + (isError ? " error" : "");
        window.clearTimeout(showToast.timeoutId);
        showToast.timeoutId = window.setTimeout(function () { toast.className = "toast"; }, 4000);
    }

    async function request(path, options) {
        const settings = options || {};
        const headers = new Headers(settings.headers || {});
        headers.set("Accept", "application/json");
        if (settings.body != null) headers.set("Content-Type", "application/json");
        const token = sessionStorage.getItem(tokenKey);
        if (token) headers.set("Authorization", "Bearer " + token);

        let response;
        try {
            response = await fetch(apiBase.replace(/\/$/, "") + "/" + path.replace(/^\//, ""), {
                method: settings.method || "GET",
                headers: headers,
                body: settings.body == null ? undefined : JSON.stringify(settings.body)
            });
        } catch (_error) {
            throw new Error("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
        }

        let payload;
        try {
            payload = await response.json();
        } catch (_error) {
            throw new Error("Server mengembalikan respons yang tidak dapat dibaca.");
        }
        if (response.status === 401) {
            sessionStorage.removeItem(tokenKey);
            sessionStorage.removeItem(userKey);
            if (document.body.classList.contains("app-page")) window.location.assign(window.MEDICFLOW_LOGIN_URL);
            throw new Error(payload.message || "Sesi berakhir. Silakan masuk kembali.");
        }
        if (!response.ok || payload.status === false) {
            const details = payload.errors && typeof payload.errors === "object"
                ? Object.values(payload.errors).flat().join(" ")
                : "";
            throw new Error(payload.message || details || "Permintaan gagal (" + response.status + ").");
        }
        return payload;
    }

    async function requestImage(path) {
        const headers = new Headers({ Accept: "image/png" });
        const token = sessionStorage.getItem(tokenKey);
        if (token) headers.set("Authorization", "Bearer " + token);

        let response;
        try {
            response = await fetch(apiBase.replace(/\/$/, "") + "/" + path.replace(/^\//, ""), { headers: headers });
        } catch (_error) {
            throw new Error("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
        }

        if (response.status === 401) {
            sessionStorage.removeItem(tokenKey);
            sessionStorage.removeItem(userKey);
            if (document.body.classList.contains("app-page")) window.location.assign(window.MEDICFLOW_LOGIN_URL);
            throw new Error("Sesi berakhir. Silakan masuk kembali.");
        }
        if (!response.ok) {
            const contentType = response.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
                const payload = await response.json();
                throw new Error(payload.message || "QR belum dapat ditampilkan.");
            }
            throw new Error("QR belum dapat ditampilkan.");
        }

        return response.blob();
    }

    function formObject(form) {
        const object = {};
        new FormData(form).forEach(function (value, key) {
            if (value !== "") object[key] = value;
        });
        return object;
    }

    function setBusy(button, busy, label) {
        if (!button) return;
        if (busy) {
            button.dataset.originalText = button.textContent;
            button.disabled = true;
            button.textContent = label || "Memproses...";
        } else {
            button.disabled = false;
            button.textContent = button.dataset.originalText || label || "Simpan";
        }
    }

    function initializeLogin() {
        const form = document.getElementById("loginForm");
        if (!form) return;
        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            const button = document.getElementById("submitButton");
            const message = document.getElementById("formMessage");
            message.textContent = "";
            message.className = "form-message";
            setBusy(button, true, "Memeriksa akun...");
            try {
                const result = await request("auth/login", { method: "POST", body: formObject(form) });
                if (!result.access_token || !result.user || !result.user.role) throw new Error("Server tidak mengembalikan sesi yang valid.");
                if (!roleMenus[result.user.role]) throw new Error("Role akun tidak dikenali. Silakan hubungi administrator.");
                sessionStorage.setItem(tokenKey, result.access_token);
                sessionStorage.setItem(userKey, JSON.stringify(result.user));
                window.location.assign(window.MEDICFLOW_APP_URL);
            } catch (error) {
                message.textContent = error.message;
                setBusy(button, false);
            }
        });
    }

    function initializeRegistration() {
        const form = document.getElementById("registerForm");
        if (!form) return;
        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            const button = document.getElementById("submitButton");
            const message = document.getElementById("formMessage");
            message.textContent = "";
            message.className = "form-message";
            setBusy(button, true, "Mendaftarkan...");
            const data = formObject(form);
            if (!data.nomor_bpjs) data.nomor_bpjs = null;
            if (!data.alamat) data.alamat = null;
            try {
                await request("auth/register", { method: "POST", body: data });
                message.textContent = "Pendaftaran berhasil. Silakan masuk menggunakan akun Anda.";
                message.className = "form-message success";
                form.reset();
                setBusy(button, false);
                window.setTimeout(function () { window.location.assign(window.MEDICFLOW_LOGIN_URL); }, 1400);
            } catch (error) {
                message.textContent = error.message;
                setBusy(button, false);
            }
        });
    }

    const pageTitles = {
        overview: "Ringkasan", appointments: "Antrean & jadwal", examinations: "Riwayat pemeriksaan",
        prescriptions: "Resep obat", notifications: "Notifikasi", profile: "Profil saya",
        queue: "Daftar pasien", schedules: "Jadwal praktik", triage: "Pemeriksaan awal", medicines: "Katalog obat",
        stock: "Stok & mutasi", pickup: "Pengambilan obat", staff: "Akun staf", resources: "Kelola data"
    };
    const state = { role: null, user: null, page: "overview", data: {} };
    let patientUpdateTimer = null;
    let patientNotificationIds = new Set();
    let patientPollingErrorShown = false;

    function panel(title, body, subtitle) {
        return '<section class="panel"><div class="panel-heading"><div><h3>' + escapeHtml(title) + '</h3>' +
            (subtitle ? '<p>' + escapeHtml(subtitle) + '</p>' : '') + '</div></div><div class="panel-body">' + body + '</div></section>';
    }

    function table(headers, rows, emptyText) {
        if (!rows.length) return '<div class="empty-state">' + escapeHtml(emptyText || "Belum ada data.") + '</div>';
        return '<div class="table-wrap"><table class="data-table"><thead><tr>' +
            headers.map(function (header) { return '<th>' + escapeHtml(header) + '</th>'; }).join("") +
            '</tr></thead><tbody>' + rows.join("") + '</tbody></table></div>';
    }

    function statusBadge(status) {
        const value = String(status || "—");
        let color = "badge";
        if (/siap|selesai|berhasil|aktif/i.test(value)) color += " badge-green";
        else if (/batal|tidak aktif|habis/i.test(value)) color += " badge-red";
        else if (/menunggu|antrean|diracik|dipanggil/i.test(value)) color += " badge-yellow";
        else if (/masuk ruangan|pemeriksaan/i.test(value)) color += " badge-blue";
        return '<span class="' + color + '">' + escapeHtml(value) + '</span>';
    }

    function statCards(items) {
        return '<div class="stat-grid">' + items.map(function (item) {
            return '<article class="stat-card"><span>' + escapeHtml(item[0]) + '</span><strong>' + escapeHtml(item[1]) + '</strong></article>';
        }).join("") + '</div>';
    }

    function renderNav() {
        const nav = document.getElementById("sideNavigation");
        nav.innerHTML = roleMenus[state.role].map(function (item) {
            return '<button class="nav-item' + (state.page === item[0] ? " active" : "") + '" type="button" data-page="' + item[0] + '">' +
                '<span class="nav-icon">' + item[1] + '</span><span>' + escapeHtml(item[2]) + '</span></button>';
        }).join("");
        nav.querySelectorAll("[data-page]").forEach(function (button) {
            button.addEventListener("click", function () {
                stopCamera();
                state.page = button.dataset.page;
                state.data.pendingPickup = null;
                renderPage();
            });
        });
        document.getElementById("pageTitle").textContent = pageTitles[state.page] || "Dashboard";
        document.getElementById("topRole").textContent = (roleLabels[state.role] || "DASHBOARD").toUpperCase();
    }

    function renderPatient() {
        const data = state.data;
        const profile = data.profile || {};
        const appointments = data.appointments || [];
        const schedules = data.schedules || [];
        const exams = data.examinations || [];
        const recipes = data.prescriptions || [];
        const notifications = data.notifications || [];

        if (state.page === "overview") {
            const upcoming = appointments.filter(function (item) { return item.status_antrean !== "Batal"; });
            return '<div class="page-intro"><div><h2>Halo, ' + escapeHtml(profile.nama_lengkap || state.user.username) + '</h2><p>Ringkasan kunjungan dan informasi kesehatan Anda.</p></div></div>' +
                statCards([["Pendaftaran aktif", upcoming.length], ["Pemeriksaan tercatat", exams.length], ["Resep", recipes.length], ["Notifikasi", notifications.length]]) +
                panel("Pendaftaran terbaru", appointmentTable(appointments.slice(0, 5), schedules), "Status antrean kunjungan Anda") +
                panel("Notifikasi terbaru", notificationList(notifications.slice(0, 4)), "Informasi dari layanan MedicFlow");
        }
        if (state.page === "appointments") {
            const scheduleOptions = schedules.map(function (item) {
                const doctor = item.nama_dokter || "Dokter";
                const poli = item.nama_poli ? " • " + item.nama_poli : "";
                const label = doctor + poli + " • " + item.hari + " " + String(item.jam_mulai).slice(0, 5) + "–" + String(item.jam_selesai).slice(0, 5);
                return '<option value="' + escapeHtml(item.id_jadwal) + '">' + escapeHtml(label) + '</option>';
            }).join("");
            return '<div class="page-intro"><div><h2>Jadwalkan kunjungan</h2><p>Pilih jadwal praktik aktif dan tanggal yang sesuai dengan hari praktik.</p></div></div>' +
                panel("Daftar antrean baru", '<form id="appointmentForm" class="inline-form">' +
                    '<div><label class="field-label" for="scheduleId">Dokter & jadwal praktik</label><select class="field" id="scheduleId" name="id_jadwal" required><option value="">Pilih jadwal</option>' + scheduleOptions + '</select></div>' +
                    '<div><label class="field-label" for="visitDate">Tanggal kunjungan</label><input class="field" id="visitDate" name="tanggal_kunjungan" type="date" min="' + new Date().toISOString().slice(0, 10) + '" required></div>' +
                    '<div><label class="field-label" for="visitNote">Catatan (opsional)</label><input class="field" id="visitNote" name="catatan_pasien" maxlength="500" placeholder="Keluhan singkat"></div>' +
                    '<button class="button button-primary" type="submit">Daftar antrean</button></form>') +
                panel("Riwayat pendaftaran", appointmentTable(appointments, schedules), "Antrean yang pernah Anda daftarkan");
        }
        if (state.page === "examinations") {
            const rows = exams.map(function (item) {
                return '<tr><td>' + formatDateTime(item.waktu_mulai) + '</td><td>' + escapeHtml(item.keluhan) + '</td><td>' + escapeHtml(item.diagnosis) + '</td><td>' + escapeHtml(item.tindakan) + '</td></tr>';
            });
            return '<div class="page-intro"><div><h2>Riwayat pemeriksaan</h2><p>Catatan pemeriksaan yang telah dilakukan dokter.</p></div></div>' +
                panel("Pemeriksaan Anda", table(["Waktu", "Keluhan", "Diagnosis", "Tindakan"], rows, "Belum ada riwayat pemeriksaan."));
        }
        if (state.page === "prescriptions") {
            return '<div class="page-intro"><div><h2>Resep obat</h2><p>Pilih cara penebusan saat resep baru diterbitkan oleh dokter.</p></div></div>' +
                '<div class="stack">' + (recipes.length ? recipes.map(function (item) {
                    const selectAction = item.status_resep === "Menunggu Pilihan"
                        ? '<div class="form-actions"><button class="button button-primary button-small" data-recipe-choice="' + item.id_resep + '" data-choice="Apotek RS" type="button">Ambil di apotek RS</button><button class="button button-secondary button-small" data-recipe-choice="' + item.id_resep + '" data-choice="Apotek Luar" type="button">Tebus di apotek luar</button></div>'
                        : "";
                    const qrPanel = item.status_resep === "Siap Diambil" && item.pilihan_penebusan === "Apotek RS"
                        ? '<div class="qr-actions"><button class="button button-secondary button-small" data-show-qr="' + escapeHtml(item.id_resep) + '" type="button">Tampilkan QR pengambilan</button><div class="qr-display" id="qr-display-' + escapeHtml(item.id_resep) + '" hidden><img class="qr-image" alt="QR verifikasi resep ' + escapeHtml(item.id_resep) + '"><p>Tunjukkan QR ini kepada petugas farmasi. QR tidak langsung menyelesaikan pengambilan.</p></div></div>'
                        : "";
                    return '<article class="info-card"><h4>Resep #' + escapeHtml(item.id_resep) + ' <span style="float:right">' + statusBadge(item.status_resep) + '</span></h4><p>Diterbitkan: ' + formatDateTime(item.waktu_diterbitkan) + '</p><p>Pilihan: ' + escapeHtml(item.pilihan_penebusan || "Belum dipilih") + '</p>' + qrPanel + selectAction + '</article>';
                }).join("") : '<div class="empty-state">Belum ada resep.</div>') + '</div>';
        }
        if (state.page === "notifications") {
            return '<div class="page-intro"><div><h2>Notifikasi web</h2><p>Informasi status kunjungan dan obat tersedia di sini.</p></div></div>' +
                panel("Semua notifikasi", notificationList(notifications), "Pemberitahuan tersimpan dalam aplikasi");
        }
        if (state.page === "profile") {
            return '<div class="page-intro"><div><h2>Profil pasien</h2><p>Perbarui informasi kontak dan data pribadi Anda.</p></div></div>' +
                panel("Informasi pribadi", '<form id="profileForm" class="form-grid">' +
                    profileField("Nama lengkap", "nama_lengkap", profile.nama_lengkap, "text", true) +
                    profileField("Tanggal lahir", "tanggal_lahir", profile.tanggal_lahir, "date", true) +
                    '<div class="field-wrap"><label class="field-label" for="profileGender">Jenis kelamin</label><select class="field" id="profileGender" name="jenis_kelamin"><option value="L"' + (profile.jenis_kelamin === "L" ? " selected" : "") + '>Laki-laki</option><option value="P"' + (profile.jenis_kelamin === "P" ? " selected" : "") + '>Perempuan</option></select></div>' +
                    profileField("Nomor telepon", "no_telepon", profile.no_telepon, "tel", true) +
                    profileField("Nomor BPJS", "nomor_bpjs", profile.nomor_bpjs, "text", false) +
                    '<div class="field-wrap field-full"><label class="field-label" for="profileAddress">Alamat</label><textarea class="field textarea" id="profileAddress" name="alamat" rows="3">' + escapeHtml(profile.alamat) + '</textarea></div>' +
                    '<div class="field-full form-actions"><button class="button button-primary" type="submit">Simpan profil</button></div></form>');
        }
        return '<div class="empty-state">Halaman tidak ditemukan.</div>';
    }

    function profileField(label, name, value, type, required) {
        return '<div class="field-wrap"><label class="field-label" for="profile-' + name + '">' + escapeHtml(label) + '</label><input class="field" id="profile-' + name + '" name="' + name + '" type="' + type + '" value="' + escapeHtml(value) + '"' + (required ? " required" : "") + '></div>';
    }

    function appointmentTable(items, schedules) {
        const rows = items.map(function (item) {
            const schedule = schedules.find(function (entry) { return String(entry.id_jadwal) === String(item.id_jadwal); }) || {};
            const scheduleLabel = (schedule.nama_dokter || "Jadwal #" + item.id_jadwal) + (schedule.nama_poli ? " • " + schedule.nama_poli : "");
            return '<tr><td><span class="cell-primary">' + formatDate(item.tanggal_kunjungan) + '</span><span class="cell-secondary">' + escapeHtml(scheduleLabel) + '</span></td><td>#' + escapeHtml(item.nomor_antrean) + '</td><td>' + statusBadge(item.status_antrean) + '</td></tr>';
        });
        return table(["Tanggal & dokter", "Nomor antrean", "Status"], rows, "Belum ada pendaftaran antrean.");
    }

    function notificationList(items) {
        if (!items.length) return '<div class="empty-state">Belum ada notifikasi.</div>';
        return items.map(function (item) {
            return '<article class="notification-card"><span class="notification-dot"></span><div><strong>' + escapeHtml(item.jenis_notifikasi || item.judul || "Informasi MedicFlow") + '</strong><p>' + escapeHtml(item.pesan || item.isi_notifikasi || "") + '</p><time>' + formatDateTime(item.waktu_dikirim || item.created_at) + ' • ' + escapeHtml(item.status || "Pending") + '</time></div></article>';
        }).join("");
    }

    function renderDoctor() {
        const queue = state.data.queue || [];
        const schedules = state.data.schedules || [];
        const examinations = state.data.examinations || [];
        const medicines = state.data.medicines || [];
        if (state.page === "overview") {
            return '<div class="page-intro"><div><h2>Selamat bertugas, ' + escapeHtml(state.user.username) + '</h2><p>Kelola antrean dan layanan pasien pada jadwal praktik Anda.</p></div></div>' +
                statCards([["Pasien dalam antrean", queue.filter(function (item) { return item.status_antrean !== "Batal"; }).length], ["Menunggu pemeriksaan awal", queue.filter(function (item) { return item.status_antrean === "Menunggu"; }).length], ["Siap diperiksa", queue.filter(function (item) { return item.status_antrean === "Siap Diperiksa"; }).length], ["Pemeriksaan tercatat", examinations.length]]) +
                panel("Antrean pasien", doctorQueueTable(queue.slice(0, 8)), "Daftar pasien pada jadwal Anda");
        }
        if (state.page === "queue") {
            return '<div class="page-intro"><div><h2>Daftar pasien</h2><p>Perbarui status antrean, lalu catat pemeriksaan pasien.</p></div></div>' +
                panel("Antrean pasien", doctorQueueTable(queue), "Pasien dapat dipanggil setelah pemeriksaan awal perawat selesai");
        }
        if (state.page === "schedules") {
            const rows = schedules.map(function (item) {
                return '<tr><td>' + escapeHtml(item.hari) + '</td><td>' + escapeHtml(String(item.jam_mulai).slice(0, 5)) + '–' + escapeHtml(String(item.jam_selesai).slice(0, 5)) + '</td><td>' + escapeHtml(item.kuota_maksimal) + '</td><td>' + statusBadge(String(item.is_active) === "1" ? "Aktif" : "Tidak aktif") + '</td><td><button class="button button-secondary button-small" data-schedule-toggle="' + escapeHtml(item.id_jadwal) + '" data-active="' + escapeHtml(item.is_active) + '" type="button">' + (String(item.is_active) === "1" ? "Nonaktifkan" : "Aktifkan") + '</button></td></tr>';
            });
            return '<div class="page-intro"><div><h2>Jadwal praktik</h2><p>Tambahkan jadwal sesuai hari dan jam layanan Anda.</p></div></div>' +
                panel("Tambah jadwal", '<form id="scheduleForm" class="inline-form"><div><label class="field-label" for="scheduleDay">Hari</label><select class="field" name="hari" id="scheduleDay" required><option value="">Pilih hari</option>' + ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"].map(function (day) { return '<option>' + day + '</option>'; }).join("") + '</select></div><div><label class="field-label">Jam mulai</label><input class="field" name="jam_mulai" type="time" required></div><div><label class="field-label">Jam selesai</label><input class="field" name="jam_selesai" type="time" required></div><div><label class="field-label">Kuota maksimal</label><input class="field" name="kuota_maksimal" type="number" min="1" max="500" value="20" required></div><button class="button button-primary" type="submit">Tambah jadwal</button></form>') +
                panel("Jadwal saya", table(["Hari", "Jam", "Kuota", "Status", "Aksi"], rows, "Belum ada jadwal praktik."));
        }
        if (state.page === "examinations") {
            const eligible = queue.filter(function (item) {
                return ["Dipanggil", "Masuk Ruangan"].includes(item.status_antrean) && item.keluhan_awal;
            });
            const queueOptions = eligible.map(function (item) { return '<option value="' + escapeHtml(item.id_pendaftaran) + '">#' + escapeHtml(item.nomor_antrean) + " • " + escapeHtml(item.nama_pasien) + " • " + formatDate(item.tanggal_kunjungan) + '</option>'; }).join("");
            const medicineOptions = medicines.map(function (item) {
                return '<option value="' + escapeHtml(item.id_obat) + '">' + escapeHtml(item.nama_obat) +
                    ' • stok ' + escapeHtml(item.stok_rs) + ' ' + escapeHtml(item.satuan) + '</option>';
            }).join("");
            const form = '<form id="examinationForm" class="form-grid">' +
                '<div class="field-wrap field-full"><label class="field-label">Pasien (sudah dipanggil/masuk ruangan)</label><select class="field" name="id_pendaftaran" required><option value="">Pilih pasien</option>' + queueOptions + '</select></div>' +
                '<div id="examinationTriageSummary" class="field-full empty-state">Pilih pasien untuk melihat catatan pemeriksaan awal perawat.</div>' +
                '<div class="field-wrap"><label class="field-label">Keluhan</label><textarea class="field textarea" name="keluhan" rows="2" required></textarea></div>' +
                '<div class="field-wrap"><label class="field-label">Diagnosis</label><textarea class="field textarea" name="diagnosis" rows="2" required></textarea></div>' +
                '<div class="field-wrap"><label class="field-label">Tindakan</label><textarea class="field textarea" name="tindakan" rows="2" required></textarea></div>' +
                '<div class="field-wrap"><label class="field-label">Tekanan darah</label><input class="field" name="tekanan_darah" placeholder="120/80"></div>' +
                '<div class="field-wrap"><label class="field-label">Suhu (°C)</label><input class="field" name="suhu_tubuh" type="number" step="0.1"></div>' +
                '<div class="field-wrap"><label class="field-label">Berat (kg)</label><input class="field" name="berat_badan" type="number" step="0.1"></div>' +
                '<div class="field-wrap"><label class="field-label">Tinggi (cm)</label><input class="field" name="tinggi_badan" type="number" step="0.1"></div>' +
                '<div class="field-wrap field-full"><label class="field-label">Catatan dokter</label><textarea class="field textarea" name="catatan_dokter" rows="2"></textarea></div>' +
                '<div class="field-full"><h3>Resep obat (opsional)</h3><p class="text-muted">Jika diisi, resep langsung masuk antrean farmasi apotek rumah sakit.</p></div>' +
                '<div class="field-wrap"><label class="field-label">Obat</label><select class="field" name="id_obat"><option value="">Tidak membuat resep</option>' + medicineOptions + '</select></div>' +
                '<div class="field-wrap"><label class="field-label">Jumlah</label><input class="field" name="jumlah" type="number" min="1"></div>' +
                '<div class="field-wrap field-full"><label class="field-label">Dosis / aturan pakai</label><input class="field" name="dosis_aturan_pakai" maxlength="255" placeholder="Contoh: 1 tablet, 3 kali sehari setelah makan"></div>' +
                '<div class="field-full form-actions"><button class="button button-primary" type="submit">Simpan pemeriksaan & resep</button></div></form>';
            const historyRows = examinations.map(function (item) { return '<tr><td>' + formatDateTime(item.waktu_mulai) + '</td><td>' + escapeHtml(item.nama_pasien) + '</td><td>' + escapeHtml(item.diagnosis) + '</td><td>' + escapeHtml(item.tindakan) + '</td></tr>'; });
            return '<div class="page-intro"><div><h2>Catat pemeriksaan</h2><p>Pasien harus berstatus Dipanggil atau Masuk Ruangan.</p></div></div>' +
                panel("Pemeriksaan baru", form) + panel("Riwayat pemeriksaan", table(["Waktu", "Pasien", "Diagnosis", "Tindakan"], historyRows, "Belum ada pemeriksaan."));
        }
        return '<div class="empty-state">Halaman tidak ditemukan.</div>';
    }

    function renderNurse() {
        const queue = state.data.queue || [];
        const waiting = queue.filter(function (item) { return item.status_antrean === "Menunggu"; });
        const ready = queue.filter(function (item) { return item.status_antrean === "Siap Diperiksa"; });
        if (state.page === "overview") {
            return '<div class="page-intro"><div><h2>Pemeriksaan awal pasien</h2><p>Catat keluhan dan tanda vital sebelum pasien dipanggil dokter.</p></div></div>' +
                statCards([["Pasien menunggu", waiting.length], ["Siap diperiksa dokter", ready.length]]) +
                panel("Antrean pemeriksaan awal", nurseQueueCards(queue.slice(0, 5)), "Setelah disimpan, pasien masuk ke antrean dokter");
        }
        if (state.page === "triage") {
            return '<div class="page-intro"><div><h2>Antrean pemeriksaan awal</h2><p>Periksa keluhan awal dan catat tanda vital pasien. Data ini dapat dilihat dokter sebelum pemeriksaan lanjutan.</p></div></div>' +
                panel("Daftar pasien", nurseQueueCards(queue), "Pasien yang telah dicatat akan berstatus Siap Diperiksa");
        }
        return '<div class="empty-state">Halaman tidak ditemukan.</div>';
    }

    function nurseQueueCards(items) {
        if (!items.length) return '<div class="empty-state">Belum ada pasien pada antrean pemeriksaan awal.</div>';
        return '<div class="stack">' + items.map(function (item) {
            const completed = item.status_antrean === "Siap Diperiksa";
            const summary = completed
                ? '<div class="text-muted"><strong>Keluhan awal:</strong> ' + escapeHtml(item.keluhan_awal) +
                    '<br><strong>Tanda vital:</strong> TD ' + escapeHtml(item.tekanan_darah) +
                    ', suhu ' + escapeHtml(item.suhu_tubuh) + ' °C, berat ' + escapeHtml(item.berat_badan) +
                    ' kg, tinggi ' + escapeHtml(item.tinggi_badan) + ' cm' +
                    (item.catatan_perawat ? '<br><strong>Catatan perawat:</strong> ' + escapeHtml(item.catatan_perawat) : "") +
                    '<br><strong>Dicatat oleh:</strong> ' + escapeHtml(item.nama_perawat || "Perawat") +
                    ' • ' + formatDateTime(item.waktu_triase) + '</div>'
                : '<p class="text-muted"><strong>Keluhan saat mendaftar:</strong> ' + escapeHtml(item.catatan_pasien || "Belum ada catatan") + '</p>' +
                    '<form class="form-grid" data-triage-form="' + escapeHtml(item.id_pendaftaran) + '">' +
                    '<div class="field-wrap field-full"><label class="field-label">Keluhan awal pasien</label><textarea class="field textarea" name="keluhan_awal" rows="2" required maxlength="2000"></textarea></div>' +
                    '<div class="field-wrap"><label class="field-label">Tekanan darah (mmHg)</label><input class="field" name="tekanan_darah" required pattern="[0-9]{2,3}/[0-9]{2,3}" placeholder="120/80"></div>' +
                    '<div class="field-wrap"><label class="field-label">Suhu (°C)</label><input class="field" name="suhu_tubuh" type="number" min="25" max="45" step="0.1" required></div>' +
                    '<div class="field-wrap"><label class="field-label">Berat (kg)</label><input class="field" name="berat_badan" type="number" min="0.1" max="500" step="0.1" required></div>' +
                    '<div class="field-wrap"><label class="field-label">Tinggi (cm)</label><input class="field" name="tinggi_badan" type="number" min="30" max="250" step="0.1" required></div>' +
                    '<div class="field-wrap field-full"><label class="field-label">Catatan perawat (opsional)</label><textarea class="field textarea" name="catatan_perawat" rows="2" maxlength="2000"></textarea></div>' +
                    '<div class="field-full form-actions"><button class="button button-primary" type="submit">Simpan pemeriksaan awal</button></div></form>';
            return '<article class="info-card"><h4>' + escapeHtml(item.nama_pasien) + ' <span style="float:right">' + statusBadge(item.status_antrean) + '</span></h4>' +
                '<p>Antrean #' + escapeHtml(item.nomor_antrean) + ' • ' + formatDate(item.tanggal_kunjungan) +
                ' • Dokter: ' + escapeHtml(item.nama_dokter) + '</p>' + summary + '</article>';
        }).join("") + '</div>';
    }

    function renderDoctorTriageSummary(appointmentId) {
        const summary = document.getElementById("examinationTriageSummary");
        if (!summary) return;
        const item = (state.data.queue || []).find(function (entry) {
            return String(entry.id_pendaftaran) === String(appointmentId);
        });
        if (!item || !item.keluhan_awal) {
            summary.className = "field-full empty-state";
            summary.textContent = "Pilih pasien untuk melihat catatan pemeriksaan awal perawat.";
            return;
        }
        summary.className = "field-full info-card";
        summary.innerHTML = '<strong>Pemeriksaan awal perawat</strong><p>Dicatat oleh ' + escapeHtml(item.nama_perawat || "Perawat") +
            ' • ' + formatDateTime(item.waktu_triase) + '</p><p><strong>Keluhan:</strong> ' + escapeHtml(item.keluhan_awal) +
            '<br><strong>Tanda vital:</strong> TD ' + escapeHtml(item.tekanan_darah_awal) +
            ', suhu ' + escapeHtml(item.suhu_tubuh_awal) + ' °C, berat ' + escapeHtml(item.berat_badan_awal) +
            ' kg, tinggi ' + escapeHtml(item.tinggi_badan_awal) + ' cm' +
            (item.catatan_perawat ? '<br><strong>Catatan:</strong> ' + escapeHtml(item.catatan_perawat) : "") + '</p>';
    }

    function doctorQueueTable(items) {
        const rows = items.map(function (item) {
            const allowed = item.status_antrean === "Siap Diperiksa" ? ["Dipanggil", "Batal"] :
                item.status_antrean === "Dipanggil" ? ["Masuk Ruangan", "Batal"] :
                    ["Menunggu", "Masuk Ruangan"].includes(item.status_antrean) ? ["Batal"] : [];
            const select = allowed.length ? '<select class="field" data-queue-status="' + escapeHtml(item.id_pendaftaran) + '" aria-label="Ubah status">' +
                '<option value="">Ubah status</option>' + allowed.map(function (status) { return '<option value="' + escapeHtml(status) + '">' + escapeHtml(status) + '</option>'; }).join("") + '</select>' : '<span class="text-muted">—</span>';
            const triage = item.keluhan_awal
                ? '<span class="cell-secondary">Pemeriksaan awal: ' + escapeHtml(item.keluhan_awal) + ' • TD ' + escapeHtml(item.tekanan_darah_awal) + ' • Perawat ' + escapeHtml(item.nama_perawat || "—") + '</span>'
                : '<span class="cell-secondary">Belum ada pemeriksaan awal perawat</span>';
            return '<tr><td><span class="cell-primary">' + escapeHtml(item.nama_pasien) + '</span><span class="cell-secondary">' + escapeHtml(item.catatan_pasien || "Tanpa catatan pasien") + '</span>' + triage + '</td><td>' + formatDate(item.tanggal_kunjungan) + '</td><td>#' + escapeHtml(item.nomor_antrean) + '</td><td>' + statusBadge(item.status_antrean) + '</td><td>' + select + '</td></tr>';
        });
        return table(["Pasien", "Tanggal", "Antrean", "Status", "Tindakan"], rows, "Belum ada pasien pada antrean.");
    }

    function renderPharmacy() {
        const medicines = state.data.medicines || [];
        const recipes = state.data.recipes || [];
        const mutations = state.data.mutations || [];
        if (state.page === "overview") {
            return '<div class="page-intro"><div><h2>Operasional farmasi</h2><p>Kelola obat, proses resep, dan catat penyerahan obat kepada pasien.</p></div></div>' +
                statCards([["Resep masuk", recipes.filter(function (item) { return item.status_resep === "Antrean Farmasi"; }).length], ["Sedang diracik", recipes.filter(function (item) { return item.status_resep === "Sedang Diracik"; }).length], ["Obat terdaftar", medicines.length], ["Stok menipis", medicines.filter(function (item) { return Number(item.stok_rs) <= Number(item.stok_minimum); }).length]]) +
                panel("Resep terbaru", pharmacyRecipeTable(recipes.slice(0, 8)), "Resep dengan pilihan penebusan di apotek rumah sakit");
        }
        if (state.page === "prescriptions") {
            return '<div class="page-intro"><div><h2>Antrean resep</h2><p>Perbarui status untuk meracik obat dan mengirim notifikasi web saat siap.</p></div></div>' +
                panel("Resep masuk", pharmacyRecipeTable(recipes), "Pasien menerima notifikasi di aplikasi saat status menjadi Siap Diambil");
        }
        if (state.page === "medicines") {
            const rows = medicines.map(function (item) {
                return '<tr><td><span class="cell-primary">' + escapeHtml(item.nama_obat) + '</span><span class="cell-secondary">' + escapeHtml(item.kode_kemenkes || "Tanpa kode") + '</span></td><td>' + escapeHtml(item.jenis_obat) + '</td><td>' + escapeHtml(item.stok_rs) + " " + escapeHtml(item.satuan) + '</td><td>' + escapeHtml(item.stok_minimum) + '</td><td>' + statusBadge(String(item.is_active) === "1" ? "Aktif" : "Tidak aktif") + '</td><td><button class="button button-secondary button-small" data-edit-medicine="' + escapeHtml(item.id_obat) + '" type="button">Ubah</button></td></tr>';
            });
            return '<div class="page-intro"><div><h2>Katalog obat</h2><p>Stok hanya berubah melalui transaksi mutasi supaya riwayatnya tercatat.</p></div></div>' +
                panel("Tambah obat", '<form id="medicineForm" class="form-grid"><div class="field-wrap"><label class="field-label">Nama obat</label><input class="field" name="nama_obat" required maxlength="150"></div><div class="field-wrap"><label class="field-label">Kode Kemenkes</label><input class="field" name="kode_kemenkes"></div><div class="field-wrap"><label class="field-label">Jenis obat</label><input class="field" name="jenis_obat" required></div><div class="field-wrap"><label class="field-label">Satuan</label><input class="field" name="satuan" required placeholder="tablet, botol"></div><div class="field-wrap"><label class="field-label">Cover BPJS</label><select class="field" name="cover_bpjs"><option value="1">Ya</option><option value="0">Tidak</option></select></div><div class="field-wrap"><label class="field-label">Stok minimum</label><input class="field" name="stok_minimum" type="number" min="0" value="0" required></div><div class="field-wrap"><label class="field-label">Harga</label><input class="field" name="harga" type="number" min="0" step="0.01" value="0"></div><div class="field-full form-actions"><button class="button button-primary" type="submit">Simpan obat</button></div></form>') +
                panel("Daftar obat", table(["Obat", "Jenis", "Stok", "Minimum", "Status", "Aksi"], rows, "Belum ada obat."));
        }
        if (state.page === "stock") {
            const medicineOptions = medicines.map(function (item) { return '<option value="' + escapeHtml(item.id_obat) + '">' + escapeHtml(item.nama_obat) + " • stok " + escapeHtml(item.stok_rs) + '</option>'; }).join("");
            const rows = mutations.map(function (item) { return '<tr><td>' + formatDateTime(item.created_at) + '</td><td>' + escapeHtml(item.nama_obat || ("Obat #" + item.id_obat)) + '</td><td>' + statusBadge(item.jenis_mutasi) + '</td><td>' + escapeHtml(item.jumlah) + '</td><td>' + escapeHtml(item.stok_sebelum) + " → " + escapeHtml(item.stok_sesudah) + '</td><td>' + escapeHtml(item.keterangan) + '</td></tr>'; });
            return '<div class="page-intro"><div><h2>Stok & mutasi</h2><p>Catat obat masuk, keluar, atau penyesuaian stok fisik.</p></div></div>' +
                panel("Catat mutasi stok", '<form id="stockForm" class="inline-form"><div><label class="field-label">Obat</label><select class="field" name="id_obat" required><option value="">Pilih obat</option>' + medicineOptions + '</select></div><div><label class="field-label">Jenis mutasi</label><select class="field" name="jenis_mutasi" required><option value="Masuk">Masuk</option><option value="Keluar">Keluar</option><option value="Penyesuaian">Penyesuaian</option></select></div><div><label class="field-label">Jumlah</label><input class="field" name="jumlah" type="number" min="1" required></div><div><label class="field-label">Keterangan</label><input class="field" name="keterangan" maxlength="255"></div><button class="button button-primary" type="submit">Simpan mutasi</button></form>') +
                panel("Riwayat mutasi", table(["Waktu", "Obat", "Jenis", "Jumlah", "Perubahan stok", "Keterangan"], rows, "Belum ada riwayat mutasi."));
        }
        if (state.page === "pickup") {
            return '<div class="page-intro"><div><h2>Pengambilan obat</h2><p>Pindai QR pasien, cocokkan rincian obat, lalu konfirmasi setelah obat diserahkan.</p></div></div>' +
                panel("Pindai QR pasien", '<div class="stack"><p class="text-muted">Izinkan akses kamera dan arahkan kamera belakang ke QR pasien. Setelah kode terbaca, periksa nama pasien dan rincian resep sebelum konfirmasi.</p><div class="form-actions"><button class="button button-primary" id="startCamera" type="button">Buka kamera</button><button class="button button-secondary" id="stopCamera" type="button" hidden>Matikan kamera</button></div><div id="qrReader" class="scan-reader" hidden></div><p id="scanMessage" class="scan-message" role="status" aria-live="polite"></p><form id="manualScanForm" class="inline-form"><div><label class="field-label" for="manualQrCode">Kode QR (opsi manual)</label><input class="field" id="manualQrCode" name="kode_qr_unik" autocomplete="off" required placeholder="Masukkan kode hasil pemindaian"></div><button class="button button-secondary" type="submit">Periksa kode</button></form></div>') +
                panel("Rincian resep terverifikasi", '<div id="pickupPreview" class="empty-state">Pindai atau masukkan QR untuk melihat resep.</div><form id="pickupConfirmForm" class="stack" hidden><div class="form-grid"><div class="field-wrap"><label class="field-label" for="pickupTakenBy">Diambil oleh</label><select class="field" id="pickupTakenBy" name="diambil_oleh"><option value="Pasien">Pasien</option><option value="Keluarga">Keluarga</option></select></div><div class="field-wrap" id="pickupNameWrap" hidden><label class="field-label" for="pickupName">Nama pengambil dari keluarga</label><input class="field" id="pickupName" name="nama_pengambil" maxlength="100"></div></div><div class="form-actions"><button class="button button-primary" type="submit">Konfirmasi obat telah diserahkan</button></div></form>') +
                panel("Resep siap diambil", pharmacyRecipeTable(recipes.filter(function (item) { return item.status_resep === "Siap Diambil"; }), false), "Masukkan kode yang ditampilkan pasien untuk menyelesaikan pengambilan.");
        }
        return '<div class="empty-state">Halaman tidak ditemukan.</div>';
    }

    function pharmacyRecipeTable(items, allowStatus) {
        if (allowStatus === undefined) allowStatus = true;
        const rows = items.map(function (item) {
            const details = item.detail && item.detail.length
                ? '<ul class="recipe-details">' + item.detail.map(function (line) { return '<li>' + escapeHtml(line.nama_obat || ("Obat #" + line.id_obat)) + " • " + escapeHtml(line.jumlah) + " • " + escapeHtml(line.dosis_aturan_pakai) + '</li>'; }).join("") + '</ul>'
                : "";
            const nextStatus = item.status_resep === "Antrean Farmasi" ? ["Sedang Diracik", "Siap Diambil"] :
                item.status_resep === "Sedang Diracik" ? ["Siap Diambil", "Dibatalkan"] : [];
            const action = allowStatus && nextStatus.length
                ? '<select class="field" data-recipe-status="' + escapeHtml(item.id_resep) + '"><option value="">Ubah status</option>' + nextStatus.map(function (status) { return '<option value="' + escapeHtml(status) + '">' + escapeHtml(status) + '</option>'; }).join("") + '</select>'
                : "—";
            return '<tr><td><span class="cell-primary">' + escapeHtml(item.nama_pasien || "Pasien") + '</span><span class="cell-secondary">Resep #' + escapeHtml(item.id_resep) + " • Antrean #" + escapeHtml(item.nomor_antrean) + '</span>' + details + '</td><td>' + formatDateTime(item.waktu_diterbitkan) + '</td><td>' + statusBadge(item.status_resep) + '</td><td>' + (item.status_resep === "Siap Diambil" ? '<span class="cell-secondary">Kode verifikasi tersedia di resep</span>' : escapeHtml(item.pilihan_penebusan || "Apotek RS")) + '</td><td>' + action + '</td></tr>';
        });
        return table(["Pasien / resep", "Diterbitkan", "Status", "Penebusan", "Tindakan"], rows, "Belum ada resep pada daftar ini.");
    }

    function stopCamera() {
        cameraScanning = false;
        const scanner = qrScanner;
        qrScanner = null;
        if (scanner) {
            const stopped = scanner.isScanning ? scanner.stop() : Promise.resolve();
            stopped.then(function () {
                scanner.clear();
            }).catch(function () {
                showScanMessage("Kamera gagal dimatikan. Muat ulang halaman sebelum mencoba lagi.", true);
            });
        }
        const reader = document.getElementById("qrReader");
        if (reader) reader.hidden = true;
        const startButton = document.getElementById("startCamera");
        const stopButton = document.getElementById("stopCamera");
        if (startButton) startButton.hidden = false;
        if (stopButton) stopButton.hidden = true;
    }

    function showScanMessage(message, isError) {
        const element = document.getElementById("scanMessage");
        if (!element) return;
        element.textContent = message;
        element.className = "scan-message" + (isError ? " error" : "");
    }

    async function previewPickupCode(code) {
        state.data.pendingPickup = null;
        const confirmForm = document.getElementById("pickupConfirmForm");
        const preview = document.getElementById("pickupPreview");
        if (confirmForm) confirmForm.hidden = true;
        if (!preview) return;
        preview.className = "loading-card";
        preview.innerHTML = '<span class="spinner"></span> Memeriksa QR dan status resep...';

        try {
            const result = await request("farmasi/pengambilan-obat/preview", {
                method: "POST",
                body: { kode_qr_unik: code }
            });
            const recipe = result.data;
            if (!recipe || !Array.isArray(recipe.detail) || recipe.detail.length === 0) {
                throw new Error("Detail obat resep tidak tersedia. Minta bantuan administrator.");
            }
            state.data.pendingPickup = { recipe: recipe, code: code };
            const details = recipe.detail.map(function (item) {
                return '<li><strong>' + escapeHtml(item.nama_obat) + '</strong> — ' + escapeHtml(item.jumlah) + ' ' + escapeHtml(item.satuan) +
                    '<span class="cell-secondary">' + escapeHtml(item.dosis_aturan_pakai) + '</span></li>';
            }).join("");
            preview.className = "pickup-preview";
            preview.innerHTML = '<div class="pickup-patient"><span class="eyebrow">PASIEN</span><strong>' + escapeHtml(recipe.nama_pasien) +
                '</strong><span>Resep #' + escapeHtml(recipe.id_resep) + ' • Antrean #' + escapeHtml(recipe.nomor_antrean) +
                ' • ' + formatDate(recipe.tanggal_kunjungan) + '</span></div><div><span class="eyebrow">STATUS RESEP</span><p>' +
                statusBadge(recipe.status_resep) + '</p></div><div><span class="eyebrow">OBAT YANG DISIAPKAN</span><ul class="pickup-medicine-list">' +
                details + '</ul></div>';
            confirmForm.hidden = false;
            showScanMessage("QR valid. Cocokkan pasien dan obat sebelum penyerahan.", false);
        } catch (error) {
            preview.className = "empty-state";
            preview.textContent = error.message;
            showScanMessage(error.message, true);
        }
    }

    async function startCameraScan() {
        if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showScanMessage("Kamera hanya tersedia melalui HTTPS atau localhost. Buka aplikasi dengan koneksi aman, atau gunakan input kode manual.", true);
            return;
        }
        if (typeof window.Html5Qrcode !== "function") {
            showScanMessage("Pemindai QR belum termuat. Muat ulang halaman atau gunakan input kode manual.", true);
            return;
        }

        const scanner = new window.Html5Qrcode("qrReader", { verbose: false });
        qrScanner = scanner;
        const reader = document.getElementById("qrReader");
        reader.hidden = false;
        cameraScanning = true;
        document.getElementById("startCamera").hidden = true;
        document.getElementById("stopCamera").hidden = false;
        showScanMessage("Meminta izin kamera...", false);

        try {
            await scanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                async function (decodedText) {
                    if (!cameraScanning) return;
                    cameraScanning = false;
                    stopCamera();
                    await previewPickupCode(decodedText.trim());
                },
                function () {}
            );
            showScanMessage("Arahkan kamera ke QR pasien.", false);
        } catch (error) {
            stopCamera();
            const details = error && typeof error.message === "string" ? error.message : String(error);
            showScanMessage("Kamera tidak dapat dibuka: " + details + ". Periksa izin kamera atau gunakan input kode manual.", true);
        }
    }

    const adminResources = [
        ["users", "Akun pengguna"], ["pasien", "Pasien"], ["dokter", "Dokter"],
        ["poliklinik", "Poliklinik"], ["jadwal-dokter", "Jadwal dokter"],
        ["pendaftaran", "Pendaftaran"], ["pemeriksaan", "Pemeriksaan"],
        ["resep", "Resep"], ["detail-resep", "Detail resep"], ["obat", "Obat"],
        ["pengambilan-obat", "Pengambilan obat"], ["notifikasi", "Notifikasi"]
    ];
    const resourceIdKeys = {
        users: "id_user", pasien: "id_pasien", dokter: "id_dokter", poliklinik: "id_poli",
        "jadwal-dokter": "id_jadwal", pendaftaran: "id_pendaftaran", pemeriksaan: "id_pemeriksaan",
        resep: "id_resep", "detail-resep": "id_detail", obat: "id_obat",
        "pengambilan-obat": "id_pengambilan", notifikasi: "id_notifikasi"
    };

    function renderAdmin() {
        if (state.page === "overview") {
            const counts = state.data.counts || {};
            return '<div class="page-intro"><div><h2>Kontrol operasional</h2><p>Ringkasan data yang dapat dikelola administrator.</p></div></div>' +
                statCards([["Akun", counts.users], ["Pasien", counts.pasien], ["Dokter", counts.dokter], ["Obat", counts.obat]]) +
                statCards([["Pendaftaran", counts.pendaftaran], ["Pemeriksaan", counts.pemeriksaan], ["Resep", counts.resep], ["Poliklinik", counts.poliklinik]]) +
                panel("Akses administrator", '<p class="text-muted">Pilih menu Kelola data untuk menambah, memperbarui, atau menghapus data operasional. Gunakan perubahan dengan hati-hati karena dapat berdampak pada antrean dan catatan pasien.</p>');
        }
        if (state.page === "staff") {
            const roleFilter = state.data.staffRole || "semua";
            const users = (state.data.staffUsers || []).filter(function (user) {
                return ["admin", "dokter", "perawat", "farmasi"].includes(user.role) && (roleFilter === "semua" || user.role === roleFilter);
            });
            const doctors = state.data.staffDoctors || [];
            const clinics = state.data.staffClinics || [];
            const rows = users.map(function (user) {
                const doctor = doctors.find(function (item) { return String(item.id_user) === String(user.id_user); });
                const clinic = doctor && clinics.find(function (item) { return String(item.id_poli) === String(doctor.id_poli); });
                const detail = doctor
                    ? escapeHtml(doctor.spesialisasi || "Dokter") + (clinic ? " • " + escapeHtml(clinic.nama_poli) : "")
                    : (user.role === "farmasi" ? "Petugas farmasi" : user.role === "perawat" ? "Petugas pemeriksaan awal" : "Administrator");
                return '<tr><td><span class="cell-primary">' + escapeHtml(user.nama_lengkap) + '</span><span class="cell-secondary">@' + escapeHtml(user.username) + '</span></td><td>' + statusBadge(roleLabels[user.role] || user.role) + '</td><td>' + detail + '</td><td>' + escapeHtml(user.no_telepon || "—") + '</td><td>' + statusBadge(String(user.is_active) === "1" ? "Aktif" : "Tidak aktif") + '</td></tr>';
            });
            return '<div class="page-intro"><div><h2>Akun admin, dokter, perawat & farmasi</h2><p>Periksa akun staf aktif dan detail profil dokter. Kata sandi tidak ditampilkan.</p></div></div>' +
                panel("Filter akun", '<div class="inline-form"><div><label class="field-label" for="staffRoleFilter">Tampilkan role</label><select class="field" id="staffRoleFilter"><option value="semua"' + (roleFilter === "semua" ? " selected" : "") + '>Semua akun staf</option><option value="admin"' + (roleFilter === "admin" ? " selected" : "") + '>Admin</option><option value="dokter"' + (roleFilter === "dokter" ? " selected" : "") + '>Dokter</option><option value="perawat"' + (roleFilter === "perawat" ? " selected" : "") + '>Perawat</option><option value="farmasi"' + (roleFilter === "farmasi" ? " selected" : "") + '>Farmasi</option></select></div></div>') +
                panel("Daftar akun staf (" + users.length + ")", table(["Nama / username", "Role", "Unit / spesialisasi", "Telepon", "Status"], rows, "Belum ada akun staf untuk filter ini."));
        }
        if (state.page === "resources") {
            const selected = state.data.resource || "users";
            const items = state.data.resourceItems || [];
            const headers = items.length ? Object.keys(items[0]).filter(function (key) { return key !== "password_hash"; }) : [];
            const rows = items.map(function (item) {
                const idKey = resourceIdKeys[selected];
                const cells = headers.map(function (key) {
                    let value = item[key];
                    if (value && typeof value === "object") value = JSON.stringify(value);
                    return '<td>' + escapeHtml(value == null ? "—" : String(value).slice(0, 100)) + '</td>';
                }).join("");
                return '<tr>' + cells + '<td class="actions"><button type="button" class="button button-secondary button-small" data-admin-edit="' + escapeHtml(item[idKey]) + '">Muat</button><button type="button" class="button button-danger button-small" data-admin-delete="' + escapeHtml(item[idKey]) + '">Hapus</button></td></tr>';
            });
            const selectOptions = adminResources.map(function (resource) { return '<option value="' + resource[0] + '"' + (resource[0] === selected ? " selected" : "") + '>' + escapeHtml(resource[1]) + '</option>'; }).join("");
            const form = '<div class="stack"><div><label class="field-label" for="resourceSelect">Data yang dikelola</label><select class="field" id="resourceSelect">' + selectOptions + '</select></div>' +
                '<p class="text-muted">Masukkan objek JSON sesuai field API. Untuk mengubah data, pilih baris lalu sesuaikan JSON dan ID.</p>' +
                '<form id="adminResourceForm" class="stack"><div><label class="field-label" for="resourceId">ID untuk pembaruan (kosongkan untuk data baru)</label><input class="field" id="resourceId" name="id" inputmode="numeric"></div><div><label class="field-label" for="resourceJson">Data JSON</label><textarea class="field json-area" id="resourceJson" name="json" required spellcheck="false">{}</textarea></div><div class="form-actions"><button class="button button-secondary" id="clearResourceForm" type="button">Kosongkan</button><button class="button button-primary" type="submit">Simpan data</button></div></form></div>';
            return '<div class="page-intro"><div><h2>Kelola data</h2><p>CRUD resource operasional yang diizinkan untuk administrator.</p></div></div>' +
                '<div class="split-grid">' + panel("Form data", form) + panel("Panduan field", '<p class="text-muted">Field berbeda untuk setiap resource. Gunakan ID relasi yang tersedia di database. Data akun memerlukan username, password, nama_lengkap, dan role saat dibuat. Password hanya dikirim melalui API dan tidak ditampilkan dalam daftar.</p>') + '</div>' +
                panel("Data " + (adminResources.find(function (resource) { return resource[0] === selected; }) || ["", selected])[1], table(headers.concat(["Aksi"]), rows, "Belum ada data pada resource ini."));
        }
        return '<div class="empty-state">Halaman tidak ditemukan.</div>';
    }

    async function loadRoleData() {
        if (state.role === "pasien") {
            const results = await Promise.all([
                request("pasien/me"), request("pasien/pendaftaran"), request("jadwal-dokter"),
                request("pasien/pemeriksaan"), request("pasien/resep"), request("pasien/notifikasi")
            ]);
            state.data = { profile: results[0].data, appointments: results[1].data || [], schedules: results[2].data || [], examinations: results[3].data || [], prescriptions: results[4].data || [], notifications: results[5].data || [] };
            if (state.data.profile.nama_lengkap) document.getElementById("userName").textContent = state.data.profile.nama_lengkap;
        } else if (state.role === "dokter") {
            const results = await Promise.all([
                request("dokter/antrian"), request("dokter/jadwal"), request("dokter/pemeriksaan"), request("dokter/obat")
            ]);
            state.data = { queue: results[0].data || [], schedules: results[1].data || [], examinations: results[2].data || [], medicines: results[3].data || [] };
        } else if (state.role === "perawat") {
            const result = await request("perawat/antrian");
            state.data = { queue: result.data || [] };
        } else if (state.role === "farmasi") {
            const results = await Promise.all([
                request("farmasi/obat"), request("farmasi/resep"), request("farmasi/mutasi-stok")
            ]);
            state.data = { medicines: results[0].data || [], recipes: results[1].data || [], mutations: results[2].data || [] };
        } else if (state.role === "admin") {
            const resources = ["users", "pasien", "dokter", "obat", "pendaftaran", "pemeriksaan", "resep", "poliklinik"];
            const results = await Promise.all(resources.map(function (resource) { return request("admin/" + resource); }));
            const counts = {};
            resources.forEach(function (resource, index) { counts[resource] = (results[index].data || []).length; });
            const staff = await Promise.all([request("admin/users"), request("admin/dokter"), request("admin/poliklinik")]);
            state.data = {
                counts: counts,
                resource: "users",
                resourceItems: results[0].data || [],
                staffUsers: staff[0].data || [],
                staffDoctors: staff[1].data || [],
                staffClinics: staff[2].data || [],
                staffRole: "semua"
            };
        }
    }

    async function loadAdminResource(resource) {
        const result = await request("admin/" + resource);
        state.data.resource = resource;
        state.data.resourceItems = result.data || [];
        renderPage();
    }

    function renderPage() {
        renderNav();
        const content = document.getElementById("dashboardContent");
        if (!state.role || !roleMenus[state.role]) {
            content.innerHTML = '<div class="empty-state">Akun tidak memiliki peran yang dikenali.</div>';
            return;
        }
        if (state.role === "pasien") content.innerHTML = renderPatient();
        if (state.role === "dokter") content.innerHTML = renderDoctor();
        if (state.role === "perawat") content.innerHTML = renderNurse();
        if (state.role === "farmasi") content.innerHTML = renderPharmacy();
        if (state.role === "admin") content.innerHTML = renderAdmin();
        bindPageActions();
    }

    async function refreshPage(message) {
        stopCamera();
        await loadRoleData();
        renderPage();
        if (message) showToast(message, false);
    }

    async function refreshPatientUpdates() {
        if (state.role !== "pasien" || document.hidden) return;

        try {
            const results = await Promise.all([
                request("pasien/pendaftaran"),
                request("pasien/notifikasi")
            ]);
            const notifications = results[1].data || [];
            const newNotifications = notifications.filter(function (item) {
                return !patientNotificationIds.has(String(item.id_notifikasi));
            });

            patientNotificationIds = new Set(notifications.map(function (item) {
                return String(item.id_notifikasi);
            }));
            state.data.appointments = results[0].data || [];
            state.data.notifications = notifications;
            patientPollingErrorShown = false;

            if (newNotifications.length) {
                const latest = newNotifications[0];
                showToast(latest.pesan || "Ada notifikasi baru dari MedicFlow.", false);
                if (state.page === "notifications" || state.page === "appointments") renderPage();
            }
        } catch (error) {
            if (!patientPollingErrorShown) showToast(error.message, true);
            patientPollingErrorShown = true;
        }
    }

    function startPatientUpdates() {
        if (patientUpdateTimer !== null) window.clearInterval(patientUpdateTimer);
        patientNotificationIds = new Set((state.data.notifications || []).map(function (item) {
            return String(item.id_notifikasi);
        }));
        patientUpdateTimer = window.setInterval(refreshPatientUpdates, 10000);
    }

    function handleForm(id, callback) {
        const form = document.getElementById(id);
        if (!form) return;
        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            const button = form.querySelector('button[type="submit"]');
            setBusy(button, true);
            try {
                await callback(form);
            } catch (error) {
                showToast(error.message, true);
                setBusy(button, false);
            }
        });
    }

    function bindPageActions() {
        if (state.role === "pasien") {
            handleForm("appointmentForm", async function (form) {
                const data = formObject(form);
                data.id_jadwal = Number(data.id_jadwal);
                await request("pasien/pendaftaran", { method: "POST", body: data });
                await refreshPage("Pendaftaran antrean berhasil dibuat.");
            });
            handleForm("profileForm", async function (form) {
                await request("pasien/me", { method: "PUT", body: formObject(form) });
                await refreshPage("Profil berhasil diperbarui.");
            });
            document.querySelectorAll("[data-recipe-choice]").forEach(function (button) {
                button.addEventListener("click", async function () {
                    button.disabled = true;
                    try {
                        await request("pasien/resep/" + button.dataset.recipeChoice + "/pilihan", {
                            method: "PUT", body: { pilihan_penebusan: button.dataset.choice }
                        });
                        await refreshPage("Pilihan penebusan resep berhasil disimpan.");
                    } catch (error) { showToast(error.message, true); button.disabled = false; }
                });
            });
            document.querySelectorAll("[data-show-qr]").forEach(function (button) {
                button.addEventListener("click", async function () {
                    const display = document.getElementById("qr-display-" + button.dataset.showQr);
                    const image = display && display.querySelector("img");
                    if (!display || !image) return;
                    if (image.dataset.loaded === "true") {
                        display.hidden = !display.hidden;
                        return;
                    }
                    button.disabled = true;
                    try {
                        const blob = await requestImage("pasien/resep/" + button.dataset.showQr + "/qr");
                        image.src = URL.createObjectURL(blob);
                        image.dataset.loaded = "true";
                        display.hidden = false;
                    } catch (error) {
                        showToast(error.message, true);
                    } finally {
                        button.disabled = false;
                    }
                });
            });
        }
        if (state.role === "dokter") {
            const examinationPatient = document.querySelector('#examinationForm select[name="id_pendaftaran"]');
            if (examinationPatient) examinationPatient.addEventListener("change", function () {
                renderDoctorTriageSummary(examinationPatient.value);
            });
            const medicineField = document.querySelector('#examinationForm select[name="id_obat"]');
            if (medicineField) medicineField.addEventListener("change", function () {
                const form = medicineField.form;
                const hasMedicine = medicineField.value !== "";
                form.elements.namedItem("jumlah").required = hasMedicine;
                form.elements.namedItem("dosis_aturan_pakai").required = hasMedicine;
            });
            document.querySelectorAll("[data-queue-status]").forEach(function (select) {
                select.addEventListener("change", async function () {
                    if (!select.value) return;
                    select.disabled = true;
                    try {
                        const result = await request("dokter/antrian/" + select.dataset.queueStatus, { method: "PUT", body: { status_antrean: select.value } });
                        await refreshPage(result.message || "Status antrean diperbarui.");
                    } catch (error) { showToast(error.message, true); select.disabled = false; }
                });
            });
            document.querySelectorAll("[data-schedule-toggle]").forEach(function (button) {
                button.addEventListener("click", async function () {
                    button.disabled = true;
                    try {
                        await request("dokter/jadwal/" + button.dataset.scheduleToggle, { method: "PUT", body: { is_active: String(button.dataset.active) === "1" ? 0 : 1 } });
                        await refreshPage("Jadwal berhasil diperbarui.");
                    } catch (error) { showToast(error.message, true); button.disabled = false; }
                });
            });
            handleForm("scheduleForm", async function (form) {
                const data = formObject(form);
                data.kuota_maksimal = Number(data.kuota_maksimal);
                await request("dokter/jadwal", { method: "POST", body: data });
                await refreshPage("Jadwal praktik berhasil ditambahkan.");
            });
            handleForm("examinationForm", async function (form) {
                const data = formObject(form);
                data.id_pendaftaran = Number(data.id_pendaftaran);
                ["suhu_tubuh", "berat_badan", "tinggi_badan"].forEach(function (field) { if (data[field]) data[field] = Number(data[field]); });
                if (data.id_obat) {
                    data.resep = {
                        detail: [{
                            id_obat: Number(data.id_obat),
                            jumlah: Number(data.jumlah),
                            dosis_aturan_pakai: data.dosis_aturan_pakai
                        }]
                    };
                } else {
                    data.resep = null;
                }
                delete data.id_obat;
                delete data.jumlah;
                delete data.dosis_aturan_pakai;
                const result = await request("dokter/pemeriksaan", { method: "POST", body: data });
                await refreshPage(result.message || "Pemeriksaan dan resep berhasil disimpan.");
            });
        }
        if (state.role === "perawat") {
            document.querySelectorAll("[data-triage-form]").forEach(function (form) {
                form.addEventListener("submit", async function (event) {
                    event.preventDefault();
                    const button = form.querySelector('button[type="submit"]');
                    setBusy(button, true, "Menyimpan...");
                    try {
                        const data = formObject(form);
                        ["suhu_tubuh", "berat_badan", "tinggi_badan"].forEach(function (field) {
                            data[field] = Number(data[field]);
                        });
                        await request("perawat/antrian/" + form.dataset.triageForm + "/triase", {
                            method: "POST",
                            body: data
                        });
                        await refreshPage("Pemeriksaan awal tercatat. Pasien kini siap dipanggil dokter.");
                    } catch (error) {
                        showToast(error.message, true);
                        setBusy(button, false);
                    }
                });
            });
        }
        if (state.role === "farmasi") {
            document.querySelectorAll("[data-recipe-status]").forEach(function (select) {
                select.addEventListener("change", async function () {
                    if (!select.value) return;
                    select.disabled = true;
                    try {
                        await request("farmasi/resep/" + select.dataset.recipeStatus + "/status", { method: "PUT", body: { status_resep: select.value } });
                        await refreshPage(select.value === "Siap Diambil" ? "Resep siap. Notifikasi web telah dicatat untuk pasien." : "Status resep diperbarui.");
                    } catch (error) { showToast(error.message, true); select.disabled = false; }
                });
            });
            handleForm("stockForm", async function (form) {
                const data = formObject(form);
                data.id_obat = Number(data.id_obat);
                data.jumlah = Number(data.jumlah);
                await request("farmasi/mutasi-stok", { method: "POST", body: data });
                await refreshPage("Mutasi stok berhasil dicatat.");
            });
            const startCameraButton = document.getElementById("startCamera");
            const stopCameraButton = document.getElementById("stopCamera");
            if (startCameraButton) startCameraButton.addEventListener("click", startCameraScan);
            if (stopCameraButton) stopCameraButton.addEventListener("click", function () {
                stopCamera();
                showScanMessage("Kamera dimatikan.", false);
            });
            handleForm("manualScanForm", async function (form) {
                const code = form.elements.namedItem("kode_qr_unik").value.trim();
                await previewPickupCode(code);
                form.reset();
                setBusy(form.querySelector('button[type="submit"]'), false);
            });
            const pickupTakenBy = document.getElementById("pickupTakenBy");
            if (pickupTakenBy) pickupTakenBy.addEventListener("change", function () {
                const nameWrap = document.getElementById("pickupNameWrap");
                const nameField = document.getElementById("pickupName");
                const isFamily = pickupTakenBy.value === "Keluarga";
                nameWrap.hidden = !isFamily;
                nameField.required = isFamily;
            });
            handleForm("pickupConfirmForm", async function (form) {
                const pending = state.data.pendingPickup;
                if (!pending) throw new Error("Pindai dan verifikasi QR resep terlebih dahulu.");
                const data = formObject(form);
                data.id_resep = Number(pending.recipe.id_resep);
                data.kode_qr_unik = pending.code;
                data.metode_verifikasi = "QR";
                if (data.diambil_oleh !== "Keluarga") delete data.nama_pengambil;
                await request("farmasi/pengambilan-obat", { method: "POST", body: data });
                state.data.pendingPickup = null;
                await refreshPage("Penyerahan tercatat; status resep menjadi Selesai Diambil.");
            });
            document.querySelectorAll("[data-edit-medicine]").forEach(function (button) {
                button.addEventListener("click", function () {
                    const medicine = (state.data.medicines || []).find(function (item) { return String(item.id_obat) === button.dataset.editMedicine; });
                    if (!medicine) return;
                    const form = document.getElementById("medicineForm");
                    ["nama_obat", "kode_kemenkes", "jenis_obat", "satuan", "cover_bpjs", "stok_minimum", "harga"].forEach(function (key) {
                        const field = form.elements.namedItem(key);
                        if (field) field.value = medicine[key] == null ? "" : medicine[key];
                    });
                    form.dataset.editId = medicine.id_obat;
                    const submit = form.querySelector('button[type="submit"]');
                    submit.textContent = "Simpan perubahan";
                    form.scrollIntoView({ behavior: "smooth", block: "center" });
                });
            });
            handleForm("medicineForm", async function (form) {
                const data = formObject(form);
                data.cover_bpjs = Number(data.cover_bpjs);
                data.stok_minimum = Number(data.stok_minimum);
                data.harga = Number(data.harga || 0);
                if (form.dataset.editId) {
                    await request("farmasi/obat/" + form.dataset.editId, { method: "PUT", body: data });
                    delete form.dataset.editId;
                    await refreshPage("Data obat berhasil diperbarui.");
                    return;
                }
                await request("farmasi/obat", { method: "POST", body: data });
                await refreshPage("Obat berhasil ditambahkan. Catat stok awal melalui menu Stok & mutasi.");
            });
        }
        if (state.role === "admin" && state.page === "resources") {
            document.getElementById("resourceSelect").addEventListener("change", async function (event) {
                try { await loadAdminResource(event.target.value); }
                catch (error) { showToast(error.message, true); }
            });
            handleForm("adminResourceForm", async function (form) {
                let data;
                try { data = JSON.parse(form.elements.namedItem("json").value); }
                catch (_error) { throw new Error("Data JSON tidak valid."); }
                if (!data || Array.isArray(data) || typeof data !== "object") throw new Error("Data harus berupa satu objek JSON.");
                const resource = state.data.resource || "users";
                const id = form.elements.namedItem("id").value.trim();
                const endpoint = "admin/" + resource + (id ? "/" + encodeURIComponent(id) : "");
                await request(endpoint, { method: id ? "PUT" : "POST", body: data });
                await loadAdminResource(resource);
                showToast(id ? "Data berhasil diperbarui." : "Data berhasil ditambahkan.", false);
            });
            document.getElementById("clearResourceForm").addEventListener("click", function () {
                document.getElementById("resourceId").value = "";
                document.getElementById("resourceJson").value = "{}";
            });
            document.querySelectorAll("[data-admin-edit]").forEach(function (button) {
                button.addEventListener("click", function () {
                    const item = (state.data.resourceItems || []).find(function (row) {
                        return String(row[resourceIdKeys[state.data.resource]]) === button.dataset.adminEdit;
                    });
                    if (!item) return;
                    document.getElementById("resourceId").value = item[resourceIdKeys[state.data.resource]];
                    document.getElementById("resourceJson").value = JSON.stringify(item, null, 2);
                    document.getElementById("adminResourceForm").scrollIntoView({ behavior: "smooth", block: "center" });
                });
            });
            document.querySelectorAll("[data-admin-delete]").forEach(function (button) {
                button.addEventListener("click", async function () {
                    if (!window.confirm("Hapus data ini? Tindakan ini tidak dapat dibatalkan.")) return;
                    button.disabled = true;
                    try {
                        await request("admin/" + state.data.resource + "/" + encodeURIComponent(button.dataset.adminDelete), { method: "DELETE" });
                        await loadAdminResource(state.data.resource);
                        showToast("Data berhasil dihapus.", false);
                    } catch (error) { showToast(error.message, true); button.disabled = false; }
                });
            });
        }
        if (state.role === "admin" && state.page === "staff") {
            document.getElementById("staffRoleFilter").addEventListener("change", function (event) {
                state.data.staffRole = event.target.value;
                renderPage();
            });
        }
    }

    async function initializeDashboard() {
        if (!document.body.classList.contains("app-page")) return;
        const token = sessionStorage.getItem(tokenKey);
        const cachedUser = sessionStorage.getItem(userKey);
        if (!token || !cachedUser) {
            window.location.replace(window.MEDICFLOW_LOGIN_URL);
            return;
        }
        try {
            state.user = JSON.parse(cachedUser);
            state.role = state.user.role;
            if (!roleMenus[state.role]) throw new Error("Peran akun tidak dikenali. Silakan hubungi administrator.");
            document.getElementById("userName").textContent = state.user.username || roleLabels[state.role];
            document.getElementById("userRole").textContent = roleLabels[state.role];
            document.getElementById("userAvatar").textContent = (state.user.username || roleLabels[state.role]).slice(0, 1).toUpperCase();
            document.getElementById("todayLabel").textContent = new Intl.DateTimeFormat("id-ID", { dateStyle: "full" }).format(new Date());
            document.getElementById("logoutButton").addEventListener("click", function () {
                sessionStorage.removeItem(tokenKey);
                sessionStorage.removeItem(userKey);
                window.location.assign(window.MEDICFLOW_LOGIN_URL);
            });
            await loadRoleData();
            renderPage();
            if (state.role === "pasien") startPatientUpdates();
        } catch (error) {
            document.getElementById("dashboardContent").innerHTML = '<div class="empty-state">' + escapeHtml(error.message) + '</div>';
        }
    }

    initializeLogin();
    initializeRegistration();
    initializeDashboard();
}());
