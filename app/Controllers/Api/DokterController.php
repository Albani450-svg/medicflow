<?php

namespace App\Controllers\Api;

use App\Models\DokterModel;
use App\Models\PoliklinikModel;
use App\Models\UserModel;

class DokterController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new DokterModel();
    }

    public function registerDoctor()
    {
        $input = $this->request->getJSON(true);
        $clinicId = is_array($input) ? filter_var($input['id_poli'] ?? null, FILTER_VALIDATE_INT) : false;
        $averageMinutes = is_array($input)
            ? filter_var($input['rata_waktu_periksa_menit'] ?? null, FILTER_VALIDATE_INT)
            : false;

        if (
            !is_array($input)
            || !is_string($input['username'] ?? null)
            || trim($input['username']) === ''
            || strlen(trim($input['username'])) > 50
            || !is_string($input['password'] ?? null)
            || strlen($input['password']) < 10
            || strlen($input['password']) > 1024
            || !is_string($input['nama_dokter'] ?? null)
            || trim($input['nama_dokter']) === ''
            || strlen(trim($input['nama_dokter'])) > 100
            || !is_string($input['spesialisasi'] ?? null)
            || trim($input['spesialisasi']) === ''
            || strlen(trim($input['spesialisasi'])) > 100
            || $clinicId === false
            || $clinicId < 1
            || $averageMinutes === false
            || $averageMinutes < 1
            || $averageMinutes > 240
            || (isset($input['no_telepon']) && !is_string($input['no_telepon']))
            || strlen((string) ($input['no_telepon'] ?? '')) > 20
        ) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false,
                'message' => 'Data akun dan profil dokter tidak valid. Password minimal 10 karakter.',
            ]);
        }

        $users = new UserModel();
        $username = trim($input['username']);
        if ($users->where('username', $username)->first()) {
            return $this->response->setStatusCode(409)->setJSON([
                'status' => false,
                'message' => 'Username sudah digunakan. Silakan pilih username lain.',
            ]);
        }

        $clinic = (new PoliklinikModel())->find($clinicId);
        if (!$clinic || (int) $clinic['is_active'] !== 1) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false,
                'message' => 'Poliklinik tidak ditemukan atau sedang tidak aktif.',
            ]);
        }

        $db = db_connect();
        $db->transBegin();

        if (!$users->insert([
            'username' => $username,
            'password_hash' => password_hash($input['password'], PASSWORD_DEFAULT),
            'role' => 'dokter',
            'nama_lengkap' => trim($input['nama_dokter']),
            'no_telepon' => trim((string) ($input['no_telepon'] ?? '')) ?: null,
            'is_active' => 1,
        ])) {
            $errors = $users->errors();
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false,
                'errors' => $errors,
            ]);
        }

        $userId = (int) $users->getInsertID();
        if (!$this->model->insert([
            'id_user' => $userId,
            'id_poli' => $clinicId,
            'nama_dokter' => trim($input['nama_dokter']),
            'spesialisasi' => trim($input['spesialisasi']),
            'rata_waktu_periksa_menit' => $averageMinutes,
            'is_active' => 1,
        ])) {
            $errors = $this->model->errors();
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false,
                'errors' => $errors,
            ]);
        }

        if (!$db->transStatus()) {
            $db->transRollback();

            return $this->response->setStatusCode(500)->setJSON([
                'status' => false,
                'message' => 'Akun dan profil dokter gagal disimpan.',
            ]);
        }

        $doctorId = (int) $this->model->getInsertID();

        try {
            $this->recordOperationalActivity(
                'Pembuatan akun dokter',
                'users',
                $userId,
                'Admin membuat akun dokter #' . $doctorId . '.'
            );
        } catch (\RuntimeException $exception) {
            $db->transRollback();
            log_message('error', $exception->getMessage());

            return $this->response->setStatusCode(500)->setJSON([
                'status' => false,
                'message' => 'Akun dokter gagal dicatat pada log aktivitas.',
            ]);
        }

        $db->transCommit();

        return $this->response->setStatusCode(201)->setJSON([
            'status' => true,
            'message' => 'Akun dan profil dokter berhasil dibuat.',
            'data' => [
                'id_user' => $userId,
                'id_dokter' => $doctorId,
            ],
        ]);
    }
}