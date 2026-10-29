<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

class JWT extends BaseConfig
{
    public string $secret;

    public int $expiresIn = 3600;

    public function __construct()
    {
        parent::__construct();

        $secret = env('JWT_SECRET', '');
        $this->secret = is_string($secret) ? $secret : '';
    }
}
