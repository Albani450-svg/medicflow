<?php

namespace App\Controllers\Api;

use App\Models\ObatModel;
use App\Models\MutasiStokModel;

class MutasiStokController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new MutasiStokModel();
    }

    public function create()
    {
        $input = $this->request->getJSON(true);
        $drugId = is_array($input) ? filter_var($input['id_obat'] ?? null, FILTER_VALIDATE_INT) : false;
        $amount = is_array($input) ? filter_var($input['jumlah'] ?? null, FILTER_VALIDATE_INT) : false;
        $type = is_array($input) ? ($input['jenis_mutasi'] ?? null) : null;

        if (
            $drugId === false || $drugId < 1
            || $amount === false || $amount < 1 || $amount > 2147483647
            || !in_array($type, ['Masuk', 'Keluar', 'Penyesuaian'], true)
        ) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Jenis mutasi, obat, atau jumlah tidak valid',
            ]);
        }

        $db = db_connect();
        $db->transBegin();

        $drug = $db->query(
            'SELECT id_obat, stok_rs FROM obat WHERE id_obat = ? FOR UPDATE',
            [$drugId]
        )->getRowArray();

        if (!$drug) {
            $db->transRollback();

            return $this->response->setStatusCode(404)->setJSON([
                'status' => false, 'message' => 'Obat tidak ditemukan',
            ]);
        }

        $before = (int) $drug['stok_rs'];
        $after = match ($type) {
            'Masuk' => $before + $amount,
            'Keluar' => $before - $amount,
            'Penyesuaian' => $amount,
        };

        if ($after < 0) {
            $db->transRollback();

            return $this->response->setStatusCode(409)->setJSON([
                'status' => false, 'message' => 'Stok obat tidak mencukupi',
            ]);
        }

        if (!(new ObatModel())->update($drugId, ['stok_rs' => $after])) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Stok obat gagal diperbarui',
            ]);
        }

        if ($after > 2147483647) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'message' => 'Stok melebihi batas maksimum',
            ]);
        }

        $mutationModel = new MutasiStokModel();
        $mutationAmount = $type === 'Penyesuaian' ? abs($after - $before) : $amount;

        if (!$mutationModel->insert([
            'id_obat'      => $drugId,
            'id_user'      => $this->currentUser()['id_user'],
            'jenis_mutasi' => $type,
            'jumlah'       => $mutationAmount,
            'stok_sebelum' => $before,
            'stok_sesudah' => $after,
            'keterangan'   => is_string($input['keterangan'] ?? null) ? $input['keterangan'] : null,
        ])) {
            $db->transRollback();

            return $this->response->setStatusCode(400)->setJSON([
                'status' => false, 'errors' => $mutationModel->errors(),
            ]);
        }

        $db->transCommit();

        return $this->response->setStatusCode(201)->setJSON([
            'status' => true,
            'data'   => ['stok_sebelum' => $before, 'stok_sesudah' => $after],
        ]);
    }
}