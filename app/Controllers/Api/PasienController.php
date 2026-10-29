<?php

namespace App\Controllers\Api;

use App\Models\PasienModel;
use App\Models\UserModel;

class PasienController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new PasienModel();
    }

    public function me()
    {
        $profile = $this->model->where('id_user', $this->currentUser()['id_user'])->first();

        if (!$profile) {
            return $this->response->setStatusCode(404)->setJSON([
                'status'  => false,
                'message' => 'Profil pasien tidak ditemukan',
            ]);
        }

        return $this->response->setJSON([
            'status' => true,
            'data'   => $profile,
        ]);
    }

    public function updateMe()
    {
        $profile = $this->model->where('id_user', $this->currentUser()['id_user'])->first();

        if (!$profile) {
            return $this->response->setStatusCode(404)->setJSON([
                'status'  => false,
                'message' => 'Profil pasien tidak ditemukan',
            ]);
        }

        $input = $this->request->getJSON(true);

        if (!is_array($input) || $input === []) {
            return $this->response->setStatusCode(400)->setJSON([
                'status'  => false,
                'message' => 'Data pembaruan tidak boleh kosong',
            ]);
        }

        $data = array_intersect_key($input, array_flip([
            'nomor_bpjs',
            'nama_lengkap',
            'tanggal_lahir',
            'jenis_kelamin',
            'alamat',
            'no_telepon',
        ]));

        if ($data === []) {
            return $this->response->setStatusCode(400)->setJSON([
                'status'  => false,
                'message' => 'Tidak ada field profil yang dapat diperbarui',
            ]);
        }

        if (
            (isset($data['nama_lengkap']) && (!is_string($data['nama_lengkap']) || trim($data['nama_lengkap']) === '' || strlen($data['nama_lengkap']) > 150))
            || (array_key_exists('nomor_bpjs', $data) && $data['nomor_bpjs'] !== null && (!is_string($data['nomor_bpjs']) || strlen($data['nomor_bpjs']) > 20))
            || (isset($data['tanggal_lahir']) && (!is_string($data['tanggal_lahir']) || !$this->isValidDate($data['tanggal_lahir']) || $data['tanggal_lahir'] > date('Y-m-d')))
            || (isset($data['jenis_kelamin']) && !in_array($data['jenis_kelamin'], ['L', 'P'], true))
            || (isset($data['no_telepon']) && (!is_string($data['no_telepon']) || trim($data['no_telepon']) === '' || strlen($data['no_telepon']) > 20))
            || (array_key_exists('alamat', $data) && $data['alamat'] !== null && !is_string($data['alamat']))
        ) {
            return $this->response->setStatusCode(400)->setJSON([
                'status'  => false,
                'message' => 'Data profil pasien tidak valid',
            ]);
        }

        $db = db_connect();
        $db->transBegin();

        if (!$this->model->update($profile['id_pasien'], $data)) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false,
                'errors' => $this->model->errors(),
            ]);
        }

        $accountUpdates = array_intersect_key($data, array_flip(['nama_lengkap', 'no_telepon']));

        if ($accountUpdates !== [] && !(new UserModel())->update($profile['id_user'], $accountUpdates)) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false,
                'message' => 'Data akun pasien gagal diperbarui',
            ]);
        }

        $db->transCommit();

        return $this->response->setJSON([
            'status'  => true,
            'message' => 'Profil pasien berhasil diperbarui',
        ]);
    }

    private function isValidDate(string $date): bool
    {
        $parsed = \DateTimeImmutable::createFromFormat('!Y-m-d', $date);

        return $parsed !== false && $parsed->format('Y-m-d') === $date;
    }
}