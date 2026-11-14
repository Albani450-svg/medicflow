<?php

namespace App\Models;

use CodeIgniter\Model;

class RiwayatKlinisPasienModel extends Model
{
    protected $table = 'riwayat_klinis_pasien';
    protected $primaryKey = 'id_pasien';
    protected $useAutoIncrement = false;
    protected $allowedFields = [
        'id_pasien',
        'alergi',
        'obat_aktif',
        'id_user_diperbarui',
    ];
    protected $useTimestamps = false;
}
