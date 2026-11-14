"use strict";

function renderPatient() {
    const data = state.data;
    const profile = data.profile || {};
    const appointments = data.appointments || [];
    const schedules = data.schedules || [];
    const exams = data.examinations || [];
    const recipes = data.prescriptions || [];
    const notifications = data.notifications || [];
    const clinicalHistory = data.clinicalHistory || {};

    if (state.page === "overview") {
        const activeStatuses = ["Menunggu", "Siap Diperiksa", "Dipanggil", "Masuk Ruangan"];
        const upcoming = appointments.filter(function (item) { return activeStatuses.includes(item.status_antrean); });
        return '<div class="page-intro"><div><h2>Halo, ' + escapeHtml(profile.nama_lengkap || state.user.username) + '</h2><p>Ringkasan kunjungan dan informasi kesehatan Anda.</p></div></div>' +
            statCards([["Pendaftaran aktif", upcoming.length], ["Pemeriksaan tercatat", exams.length], ["Resep", recipes.length], ["Notifikasi", notifications.length]]) +
            panel("Informasi kesehatan", '<p><strong>Alergi:</strong> ' + escapeHtml(clinicalHistory.alergi || "Belum dicatat") + '</p><p><strong>Obat aktif:</strong> ' + escapeHtml(clinicalHistory.obat_aktif || "Belum dicatat") + '</p><p class="text-muted">Informasi ini dicatat dokter dan dapat diperbarui saat pemeriksaan.</p>', "Catatan klinis Anda") +
            panel("Notifikasi perangkat", deviceNotificationSettings(), "Tampilkan pemberitahuan di perangkat ini") +
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
            panel("Notifikasi perangkat", deviceNotificationSettings(), "Pemberitahuan pop-up di laptop atau ponsel") +
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

function deviceNotificationSettings() {
    if (!window.isSecureContext || !("Notification" in window)) {
        return '<p class="text-muted">Browser ini tidak mendukung notifikasi perangkat. Buka aplikasi melalui HTTPS atau localhost dengan browser yang mendukung notifikasi.</p>';
    }

    if (Notification.permission === "granted") {
        return '<p class="text-muted">Notifikasi perangkat aktif. Pemberitahuan baru akan muncul saat MedicFlow terbuka, termasuk ketika tab berada di latar.</p>';
    }

    if (Notification.permission === "denied") {
        return '<p class="text-muted">Izin notifikasi diblokir oleh browser. Ubah izin notifikasi MedicFlow melalui pengaturan situs di browser.</p>';
    }

    return '<p class="text-muted">Izinkan browser menampilkan pop-up saat ada panggilan dokter atau obat siap. MedicFlow perlu tetap terbuka di browser.</p>' +
        '<button class="button button-primary" type="button" data-enable-device-notifications>Aktifkan notifikasi perangkat</button>';
}
