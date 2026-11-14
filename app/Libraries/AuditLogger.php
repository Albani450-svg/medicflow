<?php

namespace App\Libraries;

use App\Models\LogAktivitasModel;
use RuntimeException;

class AuditLogger
{
    public static function record(
        int $userId,
        string $activity,
        ?string $table = null,
        ?int $referenceId = null,
        ?string $description = null
    ): void {
        $model = new LogAktivitasModel();

        if (!$model->insert([
            'id_user' => $userId,
            'aktivitas' => substr($activity, 0, 100),
            'tabel_referensi' => $table === null ? null : substr($table, 0, 100),
            'id_referensi' => $referenceId,
            'keterangan' => $description,
            'ip_address' => service('request')->getIPAddress(),
        ])) {
            throw new RuntimeException('Log aktivitas gagal disimpan.');
        }
    }
}
