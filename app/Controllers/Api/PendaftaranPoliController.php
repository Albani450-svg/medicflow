<?php

namespace App\Controllers\Api;

use App\Models\DokterModel;
use App\Models\JadwalDokterModel;
use App\Models\PasienModel;
use App\Models\PendaftaranPoliModel;
use DateTimeImmutable;
use App\Models\NotifikasiModel;

class PendaftaranPoliController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new PendaftaranPoliModel();
    }

    public function mine()
    {
        $patientId = $this->linkedProfileId(new PasienModel(), 'id_pasien');

        if ($patientId === null) {
            return $this->profileNotFound();
        }

        return $this->response->setJSON([
            'status' => true,
            'data'   => $this->model
                ->where('id_pasien', $patientId)
                ->orderBy('tanggal_kunjungan', 'DESC')
                ->findAll(),
        ]);
    }

    public function register()
    {
        $patientId = $this->linkedProfileId(new PasienModel(), 'id_pasien');

        if ($patientId === null) {
            return $this->profileNotFound();
        }

        $input = $this->request->getJSON(true);
        $date  = is_array($input) ? ($input['tanggal_kunjungan'] ?? null) : null;
        $scheduleId = is_array($input) ? filter_var($input['id_jadwal'] ?? null, FILTER_VALIDATE_INT) : false;
        $note = is_array($input) ? ($input['catatan_pasien'] ?? null) : null;
        $parsedDate = is_string($date) ? DateTimeImmutable::createFromFormat('!Y-m-d', $date) : false;

        if (
            $scheduleId === false || $scheduleId < 1
            || !is_string($date) || $parsedDate === false || $parsedDate->format('Y-m-d') !== $date
            || $date < date('Y-m-d')
            || ($note !== null && !is_string($note))
        ) {
            return $this->response->setStatusCode(400)->setJSON([
                'status'  => false,
                'message' => 'Jadwal, tanggal kunjungan, atau catatan tidak valid',
            ]);
        }

        $db = db_connect();
        $db->transBegin();

        $schedule = $db->query(
            'SELECT id_jadwal, kuota_maksimal, is_active FROM jadwal_dokter WHERE id_jadwal = ? FOR UPDATE',
            [$scheduleId]
        )->getRowArray();

        if (!$schedule || (int) $schedule['is_active'] !== 1) {
            $db->transRollback();

            return $this->response->setStatusCode(404)->setJSON([
                'status'  => false,
                'message' => 'Jadwal dokter tidak ditemukan atau tidak aktif',
            ]);
        }

        $scheduleDay = $db->query(
            'SELECT hari FROM jadwal_dokter WHERE id_jadwal = ?',
            [$scheduleId]
        )->getRowArray()['hari'];
        $days = [1 => 'Senin', 2 => 'Selasa', 3 => 'Rabu', 4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu', 7 => 'Minggu'];

        if ($days[(int) $parsedDate->format('N')] !== $scheduleDay) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status'  => false,
                'message' => 'Tanggal kunjungan tidak sesuai dengan hari praktik dokter',
            ]);
        }

        $duplicate = $this->model
            ->where('id_pasien', $patientId)
            ->where('id_jadwal', $scheduleId)
            ->where('tanggal_kunjungan', $date)
            ->whereNotIn('status_antrean', ['Batal'])
            ->first();

        if ($duplicate) {
            $db->transRollback();

            return $this->response->setStatusCode(409)->setJSON([
                'status'  => false,
                'message' => 'Anda sudah memiliki pendaftaran pada jadwal tersebut',
            ]);
        }

        $count = $this->model
            ->where('id_jadwal', $scheduleId)
            ->where('tanggal_kunjungan', $date)
            ->whereNotIn('status_antrean', ['Batal'])
            ->countAllResults();

        if ($count >= (int) $schedule['kuota_maksimal']) {
            $db->transRollback();

            return $this->response->setStatusCode(409)->setJSON([
                'status'  => false,
                'message' => 'Kuota jadwal dokter pada tanggal tersebut sudah penuh',
            ]);
        }

        $maxQueue = $db->table('pendaftaran_poli')
            ->selectMax('nomor_antrean', 'nomor_terakhir')
            ->where('id_jadwal', $scheduleId)
            ->where('tanggal_kunjungan', $date)
            ->get()
            ->getRowArray();

        $data = [
            'id_pasien'         => $patientId,
            'id_jadwal'         => $scheduleId,
            'tanggal_kunjungan' => $date,
            'nomor_antrean'     => ((int) ($maxQueue['nomor_terakhir'] ?? 0)) + 1,
        ];

        if ($note !== null) {
            $data['catatan_pasien'] = $note;
        }

        if (!$this->model->insert($data)) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false,
                'errors' => $this->model->errors(),
            ]);
        }

        $id = $this->model->getInsertID();
        $db->transCommit();

        return $this->response->setStatusCode(201)->setJSON([
            'status'  => true,
            'message' => 'Pendaftaran antrean berhasil',
            'data'    => [
                'id_pendaftaran' => $id,
                'nomor_antrean'  => $data['nomor_antrean'],
                'status_antrean' => 'Menunggu',
            ],
        ]);
    }

    public function doctorQueue()
    {
        $doctorId = $this->linkedProfileId(new DokterModel(), 'id_dokter');

        if ($doctorId === null) {
            return $this->profileNotFound();
        }

        $data = db_connect()->table('pendaftaran_poli')
            ->select(
                'pendaftaran_poli.*, pasien.nama_lengkap AS nama_pasien, pasien.no_telepon, ' .
                'jadwal_dokter.hari, jadwal_dokter.jam_mulai, jadwal_dokter.jam_selesai, ' .
                'triase_perawat.keluhan_awal, triase_perawat.tekanan_darah AS tekanan_darah_awal, ' .
                'triase_perawat.suhu_tubuh AS suhu_tubuh_awal, triase_perawat.berat_badan AS berat_badan_awal, ' .
                'triase_perawat.tinggi_badan AS tinggi_badan_awal, triase_perawat.catatan_perawat, ' .
                'triase_perawat.waktu_triase, users.nama_lengkap AS nama_perawat'
            )
            ->join('pasien', 'pasien.id_pasien = pendaftaran_poli.id_pasien')
            ->join('jadwal_dokter', 'jadwal_dokter.id_jadwal = pendaftaran_poli.id_jadwal')
            ->join('triase_perawat', 'triase_perawat.id_pendaftaran = pendaftaran_poli.id_pendaftaran', 'left')
            ->join('users', 'users.id_user = triase_perawat.id_user', 'left')
            ->where('jadwal_dokter.id_dokter', $doctorId)
            ->whereIn('pendaftaran_poli.status_antrean', [
                'Siap Diperiksa', 'Dipanggil', 'Masuk Ruangan', 'Menunggu',
                'Selesai Pemeriksaan', 'Batal',
            ])
            ->orderBy("FIELD(pendaftaran_poli.status_antrean, 'Dipanggil', 'Masuk Ruangan', 'Siap Diperiksa', 'Menunggu', 'Selesai Pemeriksaan', 'Batal')", '', false)
            ->orderBy('pendaftaran_poli.tanggal_kunjungan', 'ASC')
            ->orderBy('pendaftaran_poli.nomor_antrean', 'ASC')
            ->get()
            ->getResultArray();

        return $this->response->setJSON(['status' => true, 'data' => $data]);
    }

    public function updateQueueStatus(int $id)
    {
        $doctorId = $this->linkedProfileId(new DokterModel(), 'id_dokter');

        if ($doctorId === null) {
            return $this->profileNotFound();
        }

        $appointment = $this->model->find($id);
        $input = $this->request->getJSON(true);
        $status = is_array($input) ? ($input['status_antrean'] ?? null) : null;

        if (!$appointment) {
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Pendaftaran tidak ditemukan',
            ]);
        }

        $ownsAppointment = (new JadwalDokterModel())
            ->where('id_jadwal', $appointment['id_jadwal'])
            ->where('id_dokter', $doctorId)
            ->first();

        if (!$ownsAppointment) {
            return $this->response->setStatusCode(403)->setJSON([
                'status' => false, 'message' => 'Pendaftaran bukan pasien pada jadwal Anda',
            ]);
        }

        if (!in_array($status, ['Dipanggil', 'Masuk Ruangan', 'Batal'], true)) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Status antrean tidak valid',
            ]);
        }

        $db = db_connect();
        $db->transBegin();

        $lockedAppointment = $db->query(
            'SELECT id_pendaftaran, id_pasien, id_jadwal, nomor_antrean, status_antrean ' .
            'FROM pendaftaran_poli WHERE id_pendaftaran = ? FOR UPDATE',
            [$id]
        )->getRowArray();

        if (!$lockedAppointment) {
            $db->transRollback();

            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Pendaftaran tidak ditemukan',
            ]);
        }

        $transitions = [
            'Menunggu'       => ['Batal'],
            'Siap Diperiksa' => ['Dipanggil', 'Batal'],
            'Dipanggil'      => ['Masuk Ruangan', 'Batal'],
            'Masuk Ruangan'  => ['Batal'],
            'Selesai Pemeriksaan' => [],
            'Batal'          => [],
        ];

        if (!in_array($status, $transitions[$lockedAppointment['status_antrean']] ?? [], true)) {
            $db->transRollback();

            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Perubahan status antrean tidak sesuai urutan',
            ]);
        }

        $updates = ['status_antrean' => $status];

        if ($status === 'Dipanggil') {
            $updates['waktu_check_in'] = date('Y-m-d H:i:s');
        }

        if (!$this->model->update($id, $updates)) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'errors' => $this->model->errors(),
            ]);
        }

        if ($status === 'Dipanggil') {
            $patient = (new PasienModel())->find($lockedAppointment['id_pasien']);
            $doctor = (new DokterModel())->where('id_user', $this->currentUser()['id_user'])->first();

            if (!$patient || !$doctor) {
                $db->transRollback();

                return $this->response->setStatusCode(409)->setJSON([
                    'status' => false, 'message' => 'Data pasien atau dokter untuk notifikasi tidak ditemukan',
                ]);
            }

            $notification = new NotifikasiModel();

            if (!$notification->insert([
                'id_pasien'        => $patient['id_pasien'],
                'id_pendaftaran'   => $lockedAppointment['id_pendaftaran'],
                'jenis_notifikasi' => 'Pasien Dipanggil',
                'channel'          => 'PWA',
                'nomor_tujuan'     => $patient['no_telepon'],
                'pesan'            => 'Dokter ' . $doctor['nama_dokter'] .
                    ' memanggil Anda untuk pemeriksaan. Silakan menuju ruang praktik. Nomor antrean #' .
                    $lockedAppointment['nomor_antrean'] . '.',
                'status'           => 'Pending',
            ])) {
                $db->transRollback();

                return $this->response->setStatusCode(400)->setJSON([
                    'status' => false, 'errors' => $notification->errors(),
                ]);
            }
        }

        if (!$db->transStatus()) {
            $db->transRollback();

            return $this->response->setStatusCode(500)->setJSON([
                'status' => false, 'message' => 'Perubahan antrean gagal disimpan',
            ]);
        }

        $db->transCommit();

        return $this->response->setJSON([
            'status' => true,
            'message' => $status === 'Dipanggil'
                ? 'Pasien dipanggil dan notifikasi web berhasil dicatat'
                : 'Status antrean diperbarui',
        ]);
    }

    private function profileNotFound()
    {
        return $this->response->setStatusCode(403)->setJSON([
            'status'  => false,
            'message' => 'Profil yang terhubung ke akun tidak ditemukan',
        ]);
    }
}