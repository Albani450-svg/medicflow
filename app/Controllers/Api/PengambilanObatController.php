<?php

namespace App\Controllers\Api;

use App\Models\PengambilanObatModel;
use App\Models\ResepModel;

class PengambilanObatController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new PengambilanObatModel();
    }

    public function preview()
    {
        $input = $this->request->getJSON(true);
        $qrCode = is_array($input) ? ($input['kode_qr_unik'] ?? null) : null;

        if (!is_string($qrCode) || !preg_match('/\A[a-f0-9]{64}\z/', $qrCode)) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Kode QR tidak valid',
            ]);
        }

        $db = db_connect();
        $recipe = $db->table('resep')
            ->select('resep.id_resep, resep.status_resep, resep.pilihan_penebusan, pendaftaran_poli.nomor_antrean, pendaftaran_poli.tanggal_kunjungan, pasien.nama_lengkap AS nama_pasien')
            ->join('pendaftaran_poli', 'pendaftaran_poli.id_pendaftaran = resep.id_pendaftaran')
            ->join('pasien', 'pasien.id_pasien = pendaftaran_poli.id_pasien')
            ->where('resep.kode_qr_unik', $qrCode)
            ->get()
            ->getRowArray();

        if (!$recipe) {
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'QR tidak terdaftar pada resep MedicFlow',
            ]);
        }

        if ($recipe['status_resep'] !== 'Siap Diambil' || $recipe['pilihan_penebusan'] !== 'Apotek RS') {
            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Resep belum siap diambil atau bukan untuk apotek rumah sakit',
            ]);
        }

        $recipe['detail'] = $db->table('detail_resep')
            ->select('detail_resep.id_obat, detail_resep.jumlah, detail_resep.dosis_aturan_pakai, obat.nama_obat, obat.satuan')
            ->join('obat', 'obat.id_obat = detail_resep.id_obat')
            ->where('detail_resep.id_resep', $recipe['id_resep'])
            ->get()
            ->getResultArray();

        return $this->response->setJSON([
            'status' => true,
            'data'   => $recipe,
        ]);
    }

    public function dispense()
    {
        $input = $this->request->getJSON(true);
        $recipeId = is_array($input) ? filter_var($input['id_resep'] ?? null, FILTER_VALIDATE_INT) : false;
        $takenBy = is_array($input) ? ($input['diambil_oleh'] ?? null) : null;
        $verification = is_array($input) ? ($input['metode_verifikasi'] ?? null) : null;
        $name = is_array($input) ? ($input['nama_pengambil'] ?? null) : null;
        $qrCode = is_array($input) ? ($input['kode_qr_unik'] ?? null) : null;

        if (
            $recipeId === false || $recipeId < 1
            || !in_array($takenBy, ['Pasien', 'Keluarga'], true)
            || $verification !== 'QR'
            || !is_string($qrCode) || $qrCode === ''
            || ($name !== null && !is_string($name))
            || ($takenBy === 'Keluarga' && (!is_string($name) || trim($name) === ''))
        ) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Pengambilan obat memerlukan data valid dan verifikasi QR',
            ]);
        }

        $db = db_connect();
        $db->transBegin();

        $recipe = $db->query(
            'SELECT id_resep, status_resep, pilihan_penebusan, kode_qr_unik FROM resep WHERE id_resep = ? FOR UPDATE',
            [$recipeId]
        )->getRowArray();

        if (!$recipe) {
            $db->transRollback();

            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Resep tidak ditemukan',
            ]);
        }

        if ($recipe['status_resep'] !== 'Siap Diambil' || $recipe['pilihan_penebusan'] !== 'Apotek RS') {
            $db->transRollback();

            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Obat belum siap atau resep sudah diproses',
            ]);
        }

        if (!hash_equals((string) $recipe['kode_qr_unik'], $qrCode)) {
            $db->transRollback();

            return $this->response->setStatusCode(403)->setJSON([
                'status' => false, 'message' => 'Kode QR resep tidak valid',
            ]);
        }

        $record = [
            'id_resep'          => $recipeId,
            'id_user_petugas'   => (int) $this->currentUser()['id_user'],
            'diambil_oleh'      => $takenBy,
            'nama_pengambil'    => $name,
            'metode_verifikasi' => $verification,
            'status'            => 'Berhasil',
        ];

        if (is_string($input['catatan'] ?? null)) {
            $record['catatan'] = $input['catatan'];
        }

        if (!$this->model->insert($record)) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'errors' => $this->model->errors(),
            ]);
        }

        if (!(new ResepModel())->update($recipeId, ['status_resep' => 'Selesai Diambil'])) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Status resep gagal diperbarui',
            ]);
        }

        $db->transCommit();

        return $this->response->setStatusCode(201)->setJSON([
            'status' => true, 'message' => 'Pengambilan obat berhasil dicatat',
        ]);
    }
}