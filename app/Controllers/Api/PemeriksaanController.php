<?php

namespace App\Controllers\Api;

use App\Models\DokterModel;
use App\Models\PasienModel;
use App\Models\PemeriksaanModel;
use App\Models\PendaftaranPoliModel;
use App\Models\JadwalDokterModel;
use App\Models\ResepModel;
use App\Models\DetailResepModel;
use App\Models\ObatModel;

class PemeriksaanController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new PemeriksaanModel();
    }

    public function mine()
    {
        $patientId = $this->linkedProfileId(new PasienModel(), 'id_pasien');

        if ($patientId === null) {
            return $this->response->setStatusCode(403)->setJSON([
                'status' => false, 'message' => 'Profil pasien tidak ditemukan',
            ]);
        }

        $data = $this->model
            ->select('pemeriksaan.*, pendaftaran_poli.id_pasien')
            ->join('pendaftaran_poli', 'pendaftaran_poli.id_pendaftaran = pemeriksaan.id_pendaftaran')
            ->where('pendaftaran_poli.id_pasien', $patientId)
            ->orderBy('pemeriksaan.waktu_mulai', 'DESC')
            ->findAll();

        return $this->response->setJSON(['status' => true, 'data' => $data]);
    }

    public function doctorIndex()
    {
        $doctorId = $this->linkedProfileId(new DokterModel(), 'id_dokter');

        if ($doctorId === null) {
            return $this->response->setStatusCode(403)->setJSON([
                'status' => false, 'message' => 'Profil dokter tidak ditemukan',
            ]);
        }

        $data = $this->model
            ->select('pemeriksaan.*, pendaftaran_poli.id_pasien, pasien.nama_lengkap AS nama_pasien')
            ->join('pendaftaran_poli', 'pendaftaran_poli.id_pendaftaran = pemeriksaan.id_pendaftaran')
            ->join('pasien', 'pasien.id_pasien = pendaftaran_poli.id_pasien')
            ->where('pemeriksaan.id_dokter', $doctorId)
            ->orderBy('pemeriksaan.waktu_mulai', 'DESC')
            ->findAll();

        return $this->response->setJSON(['status' => true, 'data' => $data]);
    }

    public function createForDoctor()
    {
        $doctorId = $this->linkedProfileId(new DokterModel(), 'id_dokter');
        $input = $this->request->getJSON(true);

        if ($doctorId === null) {
            return $this->response->setStatusCode(403)->setJSON([
                'status' => false, 'message' => 'Profil dokter tidak ditemukan',
            ]);
        }

        $appointmentId = is_array($input) ? filter_var($input['id_pendaftaran'] ?? null, FILTER_VALIDATE_INT) : false;
        $prescription = is_array($input) ? ($input['resep'] ?? null) : null;
        $appointment = $appointmentId !== false
            ? (new PendaftaranPoliModel())->find($appointmentId)
            : null;

        if (!$appointment) {
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Pendaftaran tidak ditemukan',
            ]);
        }

        $schedule = (new JadwalDokterModel())
            ->where('id_jadwal', $appointment['id_jadwal'])
            ->where('id_dokter', $doctorId)
            ->first();

        if (!$schedule) {
            return $this->response->setStatusCode(403)->setJSON([
                'status' => false, 'message' => 'Pasien bukan terdaftar pada jadwal Anda',
            ]);
        }

        if (!in_array($appointment['status_antrean'], ['Dipanggil', 'Masuk Ruangan'], true)) {
            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Pasien harus dipanggil atau masuk ruangan sebelum diperiksa',
            ]);
        }

        if (!db_connect()->table('triase_perawat')->where('id_pendaftaran', $appointmentId)->countAllResults()) {
            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Pemeriksaan awal perawat harus diselesaikan sebelum pemeriksaan dokter',
            ]);
        }

        if (
            !is_array($input)
            || !is_string($input['keluhan'] ?? null) || trim($input['keluhan']) === ''
            || !is_string($input['diagnosis'] ?? null) || trim($input['diagnosis']) === ''
            || !is_string($input['tindakan'] ?? null) || trim($input['tindakan']) === ''
        ) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Keluhan, diagnosis, dan tindakan wajib diisi',
            ]);
        }

        $prescriptionDetail = null;
        if ($prescription !== null) {
            $details = is_array($prescription) ? ($prescription['detail'] ?? null) : null;

            if (
                !is_array($details)
                || count($details) !== 1
                || !is_array($details[0])
                || filter_var($details[0]['id_obat'] ?? null, FILTER_VALIDATE_INT) === false
                || (int) $details[0]['id_obat'] < 1
                || filter_var($details[0]['jumlah'] ?? null, FILTER_VALIDATE_INT) === false
                || (int) $details[0]['jumlah'] < 1
                || !is_string($details[0]['dosis_aturan_pakai'] ?? null)
                || trim($details[0]['dosis_aturan_pakai']) === ''
                || strlen($details[0]['dosis_aturan_pakai']) > 255
            ) {
                return $this->response->setStatusCode(400)->setJSON([
                    'status' => false, 'message' => 'Detail resep harus memiliki obat aktif, jumlah, dan aturan pakai yang valid',
                ]);
            }

            $prescriptionDetail = $details[0];
            if (!(new ObatModel())
                ->where('id_obat', (int) $prescriptionDetail['id_obat'])
                ->where('is_active', 1)
                ->first()) {
                return $this->response->setStatusCode(400)->setJSON([
                    'status' => false, 'message' => 'Obat tidak ditemukan atau tidak aktif',
                ]);
            }
        }

        $data = array_intersect_key($input, array_flip([
            'keluhan', 'tekanan_darah', 'suhu_tubuh', 'berat_badan', 'tinggi_badan',
            'diagnosis', 'tindakan', 'catatan_dokter', 'waktu_mulai', 'waktu_selesai',
        ]));
        $data['id_pendaftaran'] = (int) $appointmentId;
        $data['id_dokter']      = $doctorId;

        $db = db_connect();
        $db->transBegin();

        $lockedAppointment = $db->query(
            'SELECT status_antrean FROM pendaftaran_poli WHERE id_pendaftaran = ? FOR UPDATE',
            [$appointmentId]
        )->getRowArray();

        if (!$lockedAppointment) {
            $db->transRollback();

            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Pendaftaran tidak ditemukan',
            ]);
        }

        if (!in_array($lockedAppointment['status_antrean'], ['Dipanggil', 'Masuk Ruangan'], true)) {
            $db->transRollback();

            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Status antrean pasien tidak lagi mengizinkan pemeriksaan dokter',
            ]);
        }

        if ($this->model->where('id_pendaftaran', $appointmentId)->first()) {
            $db->transRollback();

            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Pemeriksaan untuk pendaftaran ini sudah tercatat',
            ]);
        }

        if (!$this->model->insert($data)) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'errors' => $this->model->errors(),
            ]);
        }

        if (!(new PendaftaranPoliModel())->update($appointmentId, ['status_antrean' => 'Selesai Pemeriksaan'])) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Status antrean gagal diperbarui',
            ]);
        }

        $prescriptionId = null;
        if ($prescriptionDetail !== null) {
            $recipeModel = new ResepModel();
            if (!$recipeModel->insert([
                'id_pendaftaran' => (int) $appointmentId,
                'kode_qr_unik' => bin2hex(random_bytes(32)),
                'waktu_diterbitkan' => date('Y-m-d H:i:s'),
                'pilihan_penebusan' => 'Apotek RS',
                'status_resep' => 'Antrean Farmasi',
            ])) {
                $db->transRollback();

                return $this->response->setStatusCode(400)->setJSON([
                    'status' => false, 'errors' => $recipeModel->errors(),
                ]);
            }

            $prescriptionId = (int) $recipeModel->getInsertID();
            $detailModel = new DetailResepModel();
            if (!$detailModel->insert([
                'id_resep' => $prescriptionId,
                'id_obat' => (int) $prescriptionDetail['id_obat'],
                'jumlah' => (int) $prescriptionDetail['jumlah'],
                'dosis_aturan_pakai' => trim($prescriptionDetail['dosis_aturan_pakai']),
            ])) {
                $db->transRollback();

                return $this->response->setStatusCode(400)->setJSON([
                    'status' => false, 'errors' => $detailModel->errors(),
                ]);
            }
        }

        try {
            $this->recordOperationalActivity(
                'Perubahan status antrean',
                'pendaftaran_poli',
                (int) $appointmentId,
                'Dokter menyelesaikan pemeriksaan; status antrean berubah menjadi Selesai Pemeriksaan.'
            );

            if ($prescriptionId !== null) {
                $this->recordOperationalActivity(
                    'Pembuatan resep dokter',
                    'resep',
                    $prescriptionId,
                    'Dokter menerbitkan resep untuk pendaftaran #' . $appointmentId . '.'
                );
            }
        } catch (\RuntimeException $exception) {
            $db->transRollback();
            log_message('error', $exception->getMessage());

            return $this->response->setStatusCode(500)->setJSON([
                'status' => false, 'message' => 'Pemeriksaan gagal dicatat pada log aktivitas',
            ]);
        }

        if (!$db->transStatus()) {
            $db->transRollback();

            return $this->response->setStatusCode(500)->setJSON([
                'status' => false, 'message' => 'Pemeriksaan dan resep gagal disimpan',
            ]);
        }

        $db->transCommit();

        return $this->response->setStatusCode(201)->setJSON([
            'status' => true,
            'id' => $this->model->getInsertID(),
            'id_resep' => $prescriptionId,
            'message' => $prescriptionId === null
                ? 'Pemeriksaan berhasil dicatat'
                : 'Pemeriksaan tersimpan dan resep masuk antrean farmasi',
        ]);
    }

    public function updateForDoctor(int $id)
    {
        $doctorId = $this->linkedProfileId(new DokterModel(), 'id_dokter');
        $record = $this->model->find($id);

        if ($doctorId === null) {
            return $this->response->setStatusCode(403)->setJSON([
                'status' => false, 'message' => 'Profil dokter tidak ditemukan',
            ]);
        }

        if (!$record) {
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Pemeriksaan tidak ditemukan',
            ]);
        }

        if ((int) $record['id_dokter'] !== $doctorId) {
            return $this->response->setStatusCode(403)->setJSON([
                'status' => false, 'message' => 'Pemeriksaan ini bukan milik Anda',
            ]);
        }

        $input = $this->request->getJSON(true);
        $data = is_array($input) ? array_intersect_key($input, array_flip([
            'keluhan', 'tekanan_darah', 'suhu_tubuh', 'berat_badan', 'tinggi_badan',
            'diagnosis', 'tindakan', 'catatan_dokter', 'waktu_selesai',
        ])) : [];

        if ($data === []) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Tidak ada data pemeriksaan yang dapat diperbarui',
            ]);
        }

        if (!$this->model->update($id, $data)) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'errors' => $this->model->errors(),
            ]);
        }

        return $this->response->setJSON(['status' => true, 'message' => 'Pemeriksaan diperbarui']);
    }
}