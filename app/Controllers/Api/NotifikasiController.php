<?php

namespace App\Controllers\Api;

use App\Models\PasienModel;
use App\Models\NotifikasiModel;

class NotifikasiController extends BaseApiController
{
    public function __construct()
    {
        $this->model = new NotifikasiModel();
    }

    public function mine()
    {
        $patientId = $this->linkedProfileId(new PasienModel(), 'id_pasien');

        if ($patientId === null) {
            return $this->response->setStatusCode(403)->setJSON([
                'status' => false, 'message' => 'Profil pasien tidak ditemukan',
            ]);
        }

        return $this->response->setJSON([
            'status' => true,
            'data'   => $this->model
                ->where('id_pasien', $patientId)
                ->orderBy('created_at', 'DESC')
                ->findAll(),
        ]);
    }
}