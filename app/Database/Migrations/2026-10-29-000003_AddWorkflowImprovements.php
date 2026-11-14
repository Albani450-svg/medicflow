<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;
use RuntimeException;

class AddWorkflowImprovements extends Migration
{
    public function up()
    {
        $this->forge->addColumn('obat', [
            'tanggal_kedaluwarsa' => [
                'type' => 'DATE',
                'null' => true,
                'after' => 'stok_minimum',
            ],
        ]);

        $this->forge->addField([
            'id_pasien' => [
                'type' => 'BIGINT',
                'unsigned' => true,
            ],
            'alergi' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'obat_aktif' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'id_user_diperbarui' => [
                'type' => 'BIGINT',
                'unsigned' => true,
                'null' => true,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => false,
                'default' => new \CodeIgniter\Database\RawSql('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
            ],
        ]);
        $this->forge->addKey('id_pasien', true);
        $this->forge->addForeignKey('id_pasien', 'pasien', 'id_pasien', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('id_user_diperbarui', 'users', 'id_user', 'SET NULL', 'CASCADE');
        $this->forge->createTable('riwayat_klinis_pasien', true);

        $this->db->query(
            'UPDATE pendaftaran_poli ' .
            'JOIN jadwal_dokter ON jadwal_dokter.id_jadwal = pendaftaran_poli.id_jadwal ' .
            'JOIN dokter ON dokter.id_dokter = jadwal_dokter.id_dokter ' .
            'SET pendaftaran_poli.estimasi_jam_masuk = DATE_ADD(' .
            'TIMESTAMP(pendaftaran_poli.tanggal_kunjungan, jadwal_dokter.jam_mulai), ' .
            'INTERVAL ((pendaftaran_poli.nomor_antrean - 1) * dokter.rata_waktu_periksa_menit) MINUTE) ' .
            'WHERE pendaftaran_poli.estimasi_jam_masuk IS NULL'
        );

        $this->db->query(
            "ALTER TABLE notifikasi MODIFY jenis_notifikasi " .
            "ENUM('Verifikasi WA','Konfirmasi Pendaftaran','Pengingat Kunjungan','QR Resep','Obat Siap','Pasien Dipanggil','Pasien Masuk Ruangan') NOT NULL"
        );
    }

    public function down()
    {
        $roomNotifications = $this->db->table('notifikasi')
            ->where('jenis_notifikasi', 'Pasien Masuk Ruangan')
            ->countAllResults();

        if ($roomNotifications > 0) {
            throw new RuntimeException('Hapus notifikasi masuk ruangan sebelum membatalkan migrasi.');
        }

        $this->db->query(
            "ALTER TABLE notifikasi MODIFY jenis_notifikasi " .
            "ENUM('Verifikasi WA','Konfirmasi Pendaftaran','Pengingat Kunjungan','QR Resep','Obat Siap','Pasien Dipanggil') NOT NULL"
        );
        $this->forge->dropTable('riwayat_klinis_pasien', true);
        $this->forge->dropColumn('obat', 'tanggal_kedaluwarsa');
    }
}
