<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;
use RuntimeException;

class AddNurseTriage extends Migration
{
    public function up()
    {
        $this->db->query("ALTER TABLE users MODIFY role VARCHAR(20) NOT NULL");
        $this->db->query("ALTER TABLE pendaftaran_poli MODIFY status_antrean VARCHAR(32) NOT NULL DEFAULT 'Menunggu'");
        $this->db->query(
            'CREATE TABLE triase_perawat (
                id_triase BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                id_pendaftaran BIGINT UNSIGNED NOT NULL,
                id_user BIGINT UNSIGNED NOT NULL,
                keluhan_awal TEXT NOT NULL,
                tekanan_darah VARCHAR(7) NOT NULL,
                suhu_tubuh DECIMAL(4,1) NOT NULL,
                berat_badan DECIMAL(5,1) NOT NULL,
                tinggi_badan DECIMAL(5,1) NOT NULL,
                catatan_perawat TEXT NULL,
                waktu_triase DATETIME NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id_triase),
                UNIQUE KEY uq_triase_perawat_pendaftaran (id_pendaftaran),
                KEY idx_triase_perawat_user (id_user),
                CONSTRAINT fk_triase_perawat_pendaftaran
                    FOREIGN KEY (id_pendaftaran) REFERENCES pendaftaran_poli (id_pendaftaran)
                    ON UPDATE CASCADE ON DELETE RESTRICT,
                CONSTRAINT fk_triase_perawat_user
                    FOREIGN KEY (id_user) REFERENCES users (id_user)
                    ON UPDATE CASCADE ON DELETE RESTRICT
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
    }

    public function down()
    {
        $nurseCount = $this->db->table('users')->where('role', 'perawat')->countAllResults();
        $readyCount = $this->db->table('pendaftaran_poli')->where('status_antrean', 'Siap Diperiksa')->countAllResults();

        if ($nurseCount > 0 || $readyCount > 0) {
            throw new RuntimeException('Hapus akun perawat dan selesaikan antrean siap diperiksa sebelum membatalkan migrasi.');
        }

        $this->forge->dropTable('triase_perawat', true);
        $this->db->query("ALTER TABLE pendaftaran_poli MODIFY status_antrean ENUM('Menunggu','Dipanggil','Masuk Ruangan','Selesai Pemeriksaan','Batal') NOT NULL DEFAULT 'Menunggu'");
        $this->db->query("ALTER TABLE users MODIFY role ENUM('admin','pasien','dokter','farmasi') NOT NULL");
    }
}
