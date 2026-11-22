"use strict";

function renderAdmin() {
    if (state.page === "overview") {
        const counts = state.data.counts || {};
        const logs = (state.data.activityLogs || []).slice(0, 10).map(function (item) {
            return '<tr><td>' + formatDateTime(item.created_at) + '</td><td>' + escapeHtml(item.username || ("User #" + item.id_user)) +
                '</td><td>' + escapeHtml(item.aktivitas) + '</td><td>' + escapeHtml(item.tabel_referensi || "—") +
                (item.id_referensi ? " #" + escapeHtml(item.id_referensi) : "") + '</td><td>' + escapeHtml(item.keterangan || "—") + '</td></tr>';
        });
        return '<div class="page-intro"><div><h2>Kontrol operasional</h2><p>Ringkasan data yang dapat dikelola administrator.</p></div></div>' +
            statCards([["Akun", counts.users], ["Pasien", counts.pasien], ["Dokter", counts.dokter], ["Obat", counts.obat]]) +
            statCards([["Pendaftaran", counts.pendaftaran], ["Pemeriksaan", counts.pemeriksaan], ["Resep", counts.resep], ["Poliklinik", counts.poliklinik]]) +
            panel("Akses administrator", '<p class="text-muted">Pilih menu Kelola data untuk menambah, memperbarui, atau menghapus data operasional. Gunakan perubahan dengan hati-hati karena dapat berdampak pada antrean dan catatan pasien.</p>') +
            panel("Log aktivitas terbaru", table(["Waktu", "Aktor", "Aktivitas", "Objek", "Keterangan"], logs, "Belum ada aktivitas tercatat."), "10 aktivitas terbaru");
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
        const activeClinics = clinics.filter(function (clinic) { return String(clinic.is_active) === "1"; });
        const clinicOptions = activeClinics.map(function (clinic) {
            return '<option value="' + escapeHtml(clinic.id_poli) + '">' + escapeHtml(clinic.nama_poli) + '</option>';
        }).join("");
        const doctorForm = '<form id="doctorAccountForm" class="form-grid">' +
            '<div class="field-wrap"><label class="field-label" for="doctorName">Nama dokter</label><input class="field" id="doctorName" name="nama_dokter" maxlength="100" required></div>' +
            '<div class="field-wrap"><label class="field-label" for="doctorUsername">Username login</label><input class="field" id="doctorUsername" name="username" maxlength="50" autocomplete="username" required></div>' +
            '<div class="field-wrap"><label class="field-label" for="doctorPassword">Password awal</label><input class="field" id="doctorPassword" name="password" type="password" minlength="10" maxlength="1024" autocomplete="new-password" required><span class="text-muted">Minimal 10 karakter. Sampaikan secara aman kepada dokter.</span></div>' +
            '<div class="field-wrap"><label class="field-label" for="doctorPhone">Nomor telepon (opsional)</label><input class="field" id="doctorPhone" name="no_telepon" maxlength="20" autocomplete="tel"></div>' +
            '<div class="field-wrap"><label class="field-label" for="doctorSpecialty">Spesialisasi</label><input class="field" id="doctorSpecialty" name="spesialisasi" maxlength="100" required></div>' +
            '<div class="field-wrap"><label class="field-label" for="doctorClinic">Poliklinik</label><select class="field" id="doctorClinic" name="id_poli" required><option value="">Pilih poliklinik</option>' + clinicOptions + '</select></div>' +
            '<div class="field-wrap"><label class="field-label" for="doctorDuration">Rata-rata waktu pemeriksaan (menit)</label><input class="field" id="doctorDuration" name="rata_waktu_periksa_menit" type="number" min="1" max="240" value="15" required></div>' +
            '<div class="field-full form-actions"><button class="button button-primary" type="submit"' + (activeClinics.length ? "" : " disabled") + '>Buat akun dokter</button></div></form>';
        return '<div class="page-intro"><div><h2>Akun admin, dokter, perawat & farmasi</h2><p>Periksa akun staf aktif dan detail profil dokter. Kata sandi tidak ditampilkan.</p></div></div>' +
            panel("Tambah dokter", activeClinics.length ? doctorForm : '<p class="text-muted">Belum ada poliklinik aktif. Aktifkan atau tambahkan poliklinik terlebih dahulu melalui Kelola data.</p>') +
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
    if (state.page === "reports") {
        return '<div class="page-intro"><div><h2>Laporan operasional</h2><p>Unduh laporan kunjungan atau pengeluaran obat dalam PDF dan Excel.</p></div></div>' +
            panel("Unduh laporan", reportDownloadForm([
                { id: "kunjungan", label: "Laporan kunjungan" },
                { id: "pengeluaran-obat", label: "Laporan pengeluaran obat" }
            ]), "Pilih rentang tanggal, lalu unduh PDF atau Excel") +
            panel("Isi laporan", '<p>Laporan kunjungan memuat antrean pada rentang tanggal, termasuk poliklinik, dokter, status, dan diagnosis bila pemeriksaan sudah dicatat.</p><p>Laporan pengeluaran obat memuat mutasi stok berjenis Keluar, baik dari peracikan resep maupun pengeluaran manual. Lembar rekapitulasi menjumlahkan obat yang keluar.</p>');
    }
    return '<div class="empty-state">Halaman tidak ditemukan.</div>';
}
