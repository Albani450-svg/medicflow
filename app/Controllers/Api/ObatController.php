<?php

namespace App\Controllers\Api;

use App\Models\ObatModel;

class ObatController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new ObatModel();
    }

    public function activeCatalog()
    {
        return $this->response->setJSON([
            'status' => true,
            'data'   => $this->model
                ->select('id_obat, nama_obat, jenis_obat, satuan, cover_bpjs, stok_rs')
                ->where('is_active', 1)
                ->groupStart()
                    ->where('tanggal_kedaluwarsa >=', date('Y-m-d'))
                    ->orWhere('tanggal_kedaluwarsa', null)
                ->groupEnd()
                ->orderBy('nama_obat')
                ->findAll(),
        ]);
    }

    public function create()
    {
        $input = $this->request->getJSON(true);

        if (!is_array($input) || $input === []) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Data obat tidak valid',
            ]);
        }

        if (array_key_exists('tanggal_kedaluwarsa', $input)
            && !$this->isValidExpiryDate($input['tanggal_kedaluwarsa'])) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Tanggal kedaluwarsa harus berupa tanggal yang valid atau kosong',
            ]);
        }

        if (($this->currentUser()['role'] ?? null) === 'farmasi') {
            if (array_key_exists('stok_rs', $input)) {
                return $this->response->setStatusCode(400)->setJSON([
                    'status' => false,
                    'message' => 'Stok awal harus dicatat melalui endpoint mutasi stok',
                ]);
            }
            $input['stok_rs'] = 0;
        }

        return $this->saveNewDrug($input);
    }

    public function update($id)
    {
        $input = $this->request->getJSON(true);

        if (!is_array($input) || $input === []) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Data pembaruan tidak valid',
            ]);
        }

        if (($this->currentUser()['role'] ?? null) === 'farmasi') {
            if (array_key_exists('stok_rs', $input)) {
                return $this->response->setStatusCode(400)->setJSON([
                    'status' => false,
                    'message' => 'Perubahan stok harus menggunakan endpoint mutasi stok',
                ]);
            }
            $input = array_intersect_key($input, array_flip([
                'kode_kemenkes', 'nama_obat', 'jenis_obat', 'satuan',
                'cover_bpjs', 'stok_minimum', 'tanggal_kedaluwarsa', 'harga', 'is_active',
            ]));

            if ($input === []) {
                return $this->response->setStatusCode(400)->setJSON([
                    'status' => false,
                    'message' => 'Perubahan stok harus menggunakan endpoint mutasi stok',
                ]);
            }
        }

        if (!$this->model->find($id)) {
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Obat tidak ditemukan',
            ]);
        }

        if (array_key_exists('tanggal_kedaluwarsa', $input)
            && !$this->isValidExpiryDate($input['tanggal_kedaluwarsa'])) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Tanggal kedaluwarsa harus berupa tanggal yang valid atau kosong',
            ]);
        }

        if (!$this->model->update($id, $input)) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'errors' => $this->model->errors(),
            ]);
        }

        return $this->response->setJSON(['status' => true, 'message' => 'Data obat diperbarui']);
    }

    private function saveNewDrug(array $data)
    {
        if (!$this->model->insert($data)) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'errors' => $this->model->errors(),
            ]);
        }

        return $this->response->setStatusCode(201)->setJSON([
            'status' => true, 'id' => $this->model->getInsertID(),
        ]);
    }

    private function isValidExpiryDate($date): bool
    {
        if ($date === null || $date === '') {
            return true;
        }

        if (!is_string($date)) {
            return false;
        }

        $parsed = \DateTimeImmutable::createFromFormat('!Y-m-d', $date);

        return $parsed !== false && $parsed->format('Y-m-d') === $date;
    }
}