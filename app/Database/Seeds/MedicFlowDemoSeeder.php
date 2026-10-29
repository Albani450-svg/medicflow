<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;
use CodeIgniter\CLI\CLI;
use DateTimeImmutable;
use RuntimeException;

class MedicFlowDemoSeeder extends Seeder
{
    private const DEMO_PASSWORD = 'MedicFlowDemo#2026';

    public function run(): void
    {
        if (ENVIRONMENT !== 'development' && ENVIRONMENT !== 'testing') {
            throw new RuntimeException('Demo accounts can only be seeded in development or testing.');
        }

        $this->db->transBegin();

        try {
            $now = date('Y-m-d H:i:s');
            $this->ensureUser('demo_admin', 'admin', 'Admin Demo MedicFlow', '081200000201', $now);
            $doctorUserId = $this->ensureUser('demo_dokter', 'dokter', 'Dr. Demo MedicFlow', '081200000202', $now);
            $this->ensureUser('demo_perawat', 'perawat', 'Perawat Demo MedicFlow', '081200000205', $now);
            $this->ensureUser('demo_farmasi', 'farmasi', 'Petugas Farmasi Demo', '081200000203', $now);
            $patientUserId = $this->ensureUser('demo_pasien', 'pasien', 'Pasien Demo MedicFlow', '081200000204', $now);

            $clinic = $this->db->table('poliklinik')->where('is_active', 1)->orderBy('id_poli')->get()->getRowArray();

            if (!$clinic) {
                throw new RuntimeException('Tambahkan minimal satu poliklinik aktif sebelum menjalankan demo seeder.');
            }

            $doctor = $this->db->table('dokter')->where('id_user', $doctorUserId)->get()->getRowArray();

            if (!$doctor) {
                $this->db->table('dokter')->insert([
                    'id_user'                    => $doctorUserId,
                    'id_poli'                    => $clinic['id_poli'],
                    'nama_dokter'                => 'Dr. Demo MedicFlow',
                    'spesialisasi'               => 'Dokter Umum',
                    'rata_waktu_periksa_menit'   => 15,
                    'is_active'                  => 1,
                    'created_at'                 => $now,
                    'updated_at'                 => $now,
                ]);
                $doctorId = (int) $this->db->insertID();
            } else {
                $doctorId = (int) $doctor['id_dokter'];
            }

            $patient = $this->db->table('pasien')->where('id_user', $patientUserId)->get()->getRowArray();

            if (!$patient) {
                $this->db->table('pasien')->insert([
                    'id_user'              => $patientUserId,
                    'nik'                  => '9900000000000001',
                    'nomor_bpjs'           => null,
                    'nama_lengkap'         => 'Pasien Demo MedicFlow',
                    'tanggal_lahir'        => '1995-05-15',
                    'jenis_kelamin'        => 'L',
                    'alamat'               => 'Data uji lokal MedicFlow',
                    'no_telepon'           => '081200000204',
                    'terdaftar_satusehat'  => 0,
                    'created_at'           => $now,
                    'updated_at'           => $now,
                ]);
                $patientId = (int) $this->db->insertID();
            } else {
                $patientId = (int) $patient['id_pasien'];
            }

            $schedule = $this->db->table('jadwal_dokter')
                ->where('id_dokter', $doctorId)
                ->where('hari', 'Senin')
                ->where('jam_mulai', '09:00:00')
                ->where('jam_selesai', '12:00:00')
                ->get()
                ->getRowArray();

            if (!$schedule) {
                $this->db->table('jadwal_dokter')->insert([
                    'id_dokter'      => $doctorId,
                    'hari'           => 'Senin',
                    'jam_mulai'      => '09:00:00',
                    'jam_selesai'    => '12:00:00',
                    'kuota_maksimal' => 20,
                    'is_active'      => 1,
                    'created_at'     => $now,
                    'updated_at'     => $now,
                ]);
                $scheduleId = (int) $this->db->insertID();
            } else {
                $scheduleId = (int) $schedule['id_jadwal'];
            }

            $scheduleDate = $this->nextDemoAppointmentDate($patientId, $scheduleId);
            $appointment = $this->db->table('pendaftaran_poli')
                ->where('id_pasien', $patientId)
                ->where('id_jadwal', $scheduleId)
                ->where('tanggal_kunjungan', $scheduleDate)
                ->get()
                ->getRowArray();

            if (!$appointment) {
                $this->db->table('pendaftaran_poli')->insert([
                    'id_pasien'         => $patientId,
                    'id_jadwal'         => $scheduleId,
                    'tanggal_kunjungan' => $scheduleDate,
                    'nomor_antrean'     => 1,
                    'status_antrean'    => 'Menunggu',
                    'catatan_pasien'    => 'DATA UJI DEMO: keluhan dapat diubah saat latihan pemeriksaan.',
                    'created_at'        => $now,
                    'updated_at'        => $now,
                ]);
            }

            if (!$this->db->transStatus()) {
                throw new RuntimeException('Database menolak sebagian data demo.');
            }

            $this->db->transCommit();

            CLI::write('Data demo MedicFlow berhasil disiapkan.', 'green');
            CLI::write('Akun demo (password semua akun: ' . self::DEMO_PASSWORD . '):');
            CLI::write('  admin    : demo_admin');
            CLI::write('  dokter   : demo_dokter');
            CLI::write('  perawat  : demo_perawat');
            CLI::write('  farmasi  : demo_farmasi');
            CLI::write('  pasien   : demo_pasien');
            CLI::write('Jadwal demo: Senin ' . $scheduleDate . ' pukul 09:00-12:00; antrean pasien berstatus Menunggu.');
            CLI::write('Alur uji: catat pemeriksaan awal sebagai perawat, panggil dan periksa pasien sebagai dokter, lalu lanjutkan resep.');
        } catch (\Throwable $exception) {
            $this->db->transRollback();
            throw $exception;
        }
    }

    private function ensureUser(string $username, string $role, string $name, string $phone, string $now): int
    {
        $user = $this->db->table('users')->where('username', $username)->get()->getRowArray();

        if ($user) {
            if ($user['role'] !== $role) {
                throw new RuntimeException('Username demo sudah digunakan oleh role yang berbeda: ' . $username);
            }

            return (int) $user['id_user'];
        }

        $this->db->table('users')->insert([
            'username'      => $username,
            'password_hash' => password_hash(self::DEMO_PASSWORD, PASSWORD_DEFAULT),
            'role'          => $role,
            'nama_lengkap'  => $name,
            'no_telepon'    => $phone,
            'is_active'     => 1,
            'created_at'    => $now,
            'updated_at'    => $now,
        ]);

        return (int) $this->db->insertID();
    }

    private function nextMonday(): string
    {
        $date = new DateTimeImmutable('today');
        $daysUntilMonday = (8 - (int) $date->format('N')) % 7;

        if ($daysUntilMonday === 0) {
            $daysUntilMonday = 7;
        }

        return $date->modify('+' . $daysUntilMonday . ' days')->format('Y-m-d');
    }

    private function nextDemoAppointmentDate(int $patientId, int $scheduleId): string
    {
        $date = new DateTimeImmutable($this->nextMonday());

        for ($week = 0; $week < 52; $week++) {
            $dateString = $date->format('Y-m-d');
            $appointment = $this->db->table('pendaftaran_poli')
                ->where('id_pasien', $patientId)
                ->where('id_jadwal', $scheduleId)
                ->where('tanggal_kunjungan', $dateString)
                ->get()
                ->getRowArray();

            if (!$appointment || !in_array($appointment['status_antrean'], ['Selesai Pemeriksaan', 'Batal'], true)) {
                return $dateString;
            }

            $date = $date->modify('+7 days');
        }

        throw new RuntimeException('Tidak menemukan tanggal kunjungan demo yang tersedia dalam 52 minggu.');
    }
}
