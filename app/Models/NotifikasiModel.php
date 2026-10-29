<?php

namespace App\Models;

use CodeIgniter\Model;

class NotifikasiModel extends Model
{
    protected $table = 'notifikasi';
    protected $primaryKey = 'id_notifikasi';

    protected $beforeInsert = ['forceWebChannel'];
    protected $beforeInsertBatch = ['forceWebChannelBatch'];

    protected $allowedFields = [
        'id_pasien',
        'id_pendaftaran',
        'jenis_notifikasi',
        'channel',
        'nomor_tujuan',
        'pesan',
        'status',
        'waktu_dikirim',
        'response_api'
    ];

    protected $useTimestamps = false;

    protected function forceWebChannel(array $eventData): array
    {
        $eventData['data']['channel'] = 'PWA';

        return $eventData;
    }

    protected function forceWebChannelBatch(array $eventData): array
    {
        foreach ($eventData['data'] as &$row) {
            $row['channel'] = 'PWA';
        }

        return $eventData;
    }
}