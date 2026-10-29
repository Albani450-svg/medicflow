<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;
use RuntimeException;

class AddPatientCalledNotification extends Migration
{
    public function up()
    {
        $this->db->query(
            "ALTER TABLE notifikasi MODIFY jenis_notifikasi " .
            "ENUM('Verifikasi WA','Konfirmasi Pendaftaran','Pengingat Kunjungan','QR Resep','Obat Siap','Pasien Dipanggil') NOT NULL"
        );
    }

    public function down()
    {
        $calledNotifications = $this->db->table('notifikasi')
            ->where('jenis_notifikasi', 'Pasien Dipanggil')
            ->countAllResults();

        if ($calledNotifications > 0) {
            throw new RuntimeException('Hapus notifikasi panggilan pasien sebelum membatalkan migrasi.');
        }

        $this->db->query(
            "ALTER TABLE notifikasi MODIFY jenis_notifikasi " .
            "ENUM('Verifikasi WA','Konfirmasi Pendaftaran','Pengingat Kunjungan','QR Resep','Obat Siap') NOT NULL"
        );
    }
}
