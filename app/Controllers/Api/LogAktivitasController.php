<?php

namespace App\Controllers\Api;

use App\Models\LogAktivitasModel;

class LogAktivitasController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new LogAktivitasModel();
    }

    public function index()
    {
        $data = db_connect()->table('log_aktivitas')
            ->select('log_aktivitas.*, users.username')
            ->join('users', 'users.id_user = log_aktivitas.id_user', 'left')
            ->orderBy('log_aktivitas.created_at', 'DESC')
            ->limit(500)
            ->get()
            ->getResultArray();

        return $this->response->setJSON(['status' => true, 'data' => $data]);
    }
}