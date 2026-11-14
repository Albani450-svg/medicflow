"use strict";

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
            ' • Dokter: ' + escapeHtml(item.nama_dokter) + '</p>' +
            (item.waktu_check_in ? '<p><strong>Check-in:</strong> ' + formatDateTime(item.waktu_check_in) + '</p>' : '<p class="text-muted">Belum check-in</p>') +
            (item.estimasi_jam_masuk ? '<p class="text-muted">Perkiraan masuk: ' + formatDateTime(item.estimasi_jam_masuk) + '</p>' : '') + summary + '</article>';
    }).join("") + '</div>';
}
