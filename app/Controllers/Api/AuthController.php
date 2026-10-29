<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\JwtTokenService;
use App\Models\PasienModel;
use App\Models\UserModel;

class AuthController extends BaseController
{
    public function login()
    {
        $credentials = $this->request->getJSON(true);

        if (!is_array($credentials)) {
            return $this->response->setStatusCode(400)->setJSON([
                'status'  => false,
                'message' => 'Kirim username dan password dalam format JSON',
            ]);
        }

        $username = $credentials['username'] ?? null;
        $password = $credentials['password'] ?? null;

        if (
            !is_string($username)
            || trim($username) === ''
            || strlen($username) > 50
            || !is_string($password)
            || $password === ''
            || strlen($password) > 1024
        ) {
            return $this->response->setStatusCode(400)->setJSON([
                'status'  => false,
                'message' => 'Username atau password tidak valid',
            ]);
        }

        $user = (new UserModel())->where('username', trim($username))->first();

        if (
            !is_array($user)
            || (int) ($user['is_active'] ?? 0) !== 1
            || !password_verify($password, (string) ($user['password_hash'] ?? ''))
        ) {
            return $this->response->setStatusCode(401)->setJSON([
                'status'  => false,
                'message' => 'Username atau password salah',
            ]);
        }

        $token = (new JwtTokenService())->issue((int) $user['id_user']);

        return $this->response->setJSON([
            'status'       => true,
            'access_token' => $token,
            'token_type'   => 'Bearer',
            'expires_in'   => config('JWT')->expiresIn,
            'user'         => [
                'id_user' => (int) $user['id_user'],
                'username' => $user['username'],
                'role'     => $user['role'],
            ],
        ]);
    }

    public function register()
    {
        $data = $this->request->getJSON(true);

        if (!is_array($data)) {
            return $this->response->setStatusCode(400)->setJSON([
                'status'  => false,
                'message' => 'Kirim data pendaftaran dalam format JSON',
            ]);
        }

        $username      = $data['username'] ?? null;
        $password      = $data['password'] ?? null;
        $name          = $data['nama_lengkap'] ?? null;
        $nik           = $data['nik'] ?? null;
        $birthDate     = $data['tanggal_lahir'] ?? null;
        $gender        = $data['jenis_kelamin'] ?? null;
        $phone         = $data['no_telepon'] ?? null;
        $address       = $data['alamat'] ?? null;
        $bpjsNumber    = $data['nomor_bpjs'] ?? null;

        if (
            !is_string($username) || !preg_match('/\A[a-zA-Z0-9._-]{3,50}\z/', $username)
            || !is_string($password) || strlen($password) < 10 || strlen($password) > 1024
            || !is_string($name) || trim($name) === '' || strlen($name) > 100
            || !is_string($nik) || !preg_match('/\A[0-9]{16}\z/', $nik)
            || !is_string($birthDate) || !$this->isValidDate($birthDate)
            || $birthDate > date('Y-m-d')
            || !in_array($gender, ['L', 'P'], true)
            || !is_string($phone) || trim($phone) === '' || strlen($phone) > 20
            || ($address !== null && (!is_string($address) || strlen($address) > 65535))
            || ($bpjsNumber !== null && (!is_string($bpjsNumber) || strlen($bpjsNumber) > 20))
        ) {
            return $this->response->setStatusCode(400)->setJSON([
                'status'  => false,
                'message' => 'Data pendaftaran pasien tidak lengkap atau tidak valid',
            ]);
        }

        $userModel   = new UserModel();
        $patientModel = new PasienModel();

        if ($userModel->where('username', $username)->first()) {
            return $this->response->setStatusCode(409)->setJSON([
                'status'  => false,
                'message' => 'Username sudah digunakan',
            ]);
        }

        if ($patientModel->where('nik', $nik)->first()) {
            return $this->response->setStatusCode(409)->setJSON([
                'status'  => false,
                'message' => 'NIK sudah terdaftar',
            ]);
        }

        $db = db_connect();
        $db->transBegin();

        if (!$userModel->insert([
            'username'      => $username,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'role'          => 'pasien',
            'nama_lengkap'  => trim($name),
            'no_telepon'    => trim($phone),
            'is_active'     => 1,
        ])) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false,
                'errors' => $userModel->errors(),
            ]);
        }

        $userId = (int) $userModel->getInsertID();

        if (!$patientModel->insert([
            'id_user'      => $userId,
            'nik'          => $nik,
            'nomor_bpjs'   => $bpjsNumber,
            'nama_lengkap' => trim($name),
            'tanggal_lahir' => $birthDate,
            'jenis_kelamin' => $gender,
            'alamat'        => $address,
            'no_telepon'    => trim($phone),
        ])) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false,
                'errors' => $patientModel->errors(),
            ]);
        }

        $db->transCommit();

        return $this->response->setStatusCode(201)->setJSON([
            'status'  => true,
            'message' => 'Pendaftaran pasien berhasil. Silakan login.',
            'id_user' => $userId,
        ]);
    }

    private function isValidDate(string $date): bool
    {
        $parsed = \DateTimeImmutable::createFromFormat('!Y-m-d', $date);

        return $parsed !== false && $parsed->format('Y-m-d') === $date;
    }
}
