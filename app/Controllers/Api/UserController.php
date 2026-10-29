<?php

namespace App\Controllers\Api;

use App\Models\UserModel;

class UserController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new UserModel();
    }

    public function index()
    {
        $data = $this->model
            ->select('id_user, username, role, nama_lengkap, no_telepon, is_active, created_at, updated_at')
            ->findAll();

        return $this->response->setJSON([
            'status' => true,
            'message' => 'Data user berhasil diambil',
            'data' => $data
        ]);
    }

    public function show($id)
    {
        $data = $this->model
            ->select('id_user, username, role, nama_lengkap, no_telepon, is_active, created_at, updated_at')
            ->find($id);

        if (!$data) {
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false,
                'message' => 'Data user tidak ditemukan'
            ]);
        }

        return $this->response->setJSON([
            'status' => true,
            'data' => $data
        ]);
    }

    public function create()
    {
        $input = $this->request->getJSON(true);
        $allowedRoles = ['admin', 'pasien', 'dokter', 'perawat', 'farmasi'];

        if (
            !is_array($input)
            || !is_string($input['username'] ?? null)
            || trim($input['username']) === ''
            || strlen($input['username']) > 50
            || !is_string($input['password'] ?? null)
            || strlen($input['password']) < 10
            || strlen($input['password']) > 1024
            || !is_string($input['nama_lengkap'] ?? null)
            || trim($input['nama_lengkap']) === ''
            || strlen($input['nama_lengkap']) > 100
            || !in_array($input['role'] ?? null, $allowedRoles, true)
        ) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Data akun atau role tidak valid',
            ]);
        }

        $data = [
            'username'      => trim($input['username']),
            'password_hash' => password_hash($input['password'], PASSWORD_DEFAULT),
            'role'          => $input['role'],
            'nama_lengkap'  => trim($input['nama_lengkap']),
            'no_telepon'    => is_string($input['no_telepon'] ?? null) ? $input['no_telepon'] : null,
            'is_active'     => 1,
        ];

        if (!$this->model->insert($data)) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'errors' => $this->model->errors(),
            ]);
        }

        return $this->response->setStatusCode(201)->setJSON([
            'status' => true, 'id_user' => $this->model->getInsertID(),
        ]);
    }

    public function update($id)
    {
        if (!$this->model->find($id)) {
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'User tidak ditemukan',
            ]);
        }

        $input = $this->request->getJSON(true);

        if (!is_array($input) || $input === []) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Data pembaruan tidak valid',
            ]);
        }

        $data = array_intersect_key($input, array_flip([
            'username', 'role', 'nama_lengkap', 'no_telepon', 'is_active',
        ]));

        if (array_key_exists('password', $input)) {
            if (!is_string($input['password']) || strlen($input['password']) < 10 || strlen($input['password']) > 1024) {
                return $this->response->setStatusCode(400)->setJSON([
                    'status' => false, 'message' => 'Password harus memiliki minimal 10 karakter',
                ]);
            }
            $data['password_hash'] = password_hash($input['password'], PASSWORD_DEFAULT);
        }

        if (array_key_exists('role', $data) && !in_array($data['role'], ['admin', 'pasien', 'dokter', 'perawat', 'farmasi'], true)) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Role tidak valid',
            ]);
        }

        if ($data === []) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Tidak ada field akun yang dapat diperbarui',
            ]);
        }

        if (!$this->model->update($id, $data)) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'errors' => $this->model->errors(),
            ]);
        }

        return $this->response->setJSON(['status' => true, 'message' => 'User diperbarui']);
    }
}