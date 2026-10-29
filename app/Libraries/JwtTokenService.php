<?php

namespace App\Libraries;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use RuntimeException;
use stdClass;

class JwtTokenService
{
    private string $secret;

    private int $expiresIn;

    public function __construct(?string $secret = null)
    {
        $config = config('JWT');

        $this->secret    = $secret ?? $config->secret;
        $this->expiresIn = $config->expiresIn;
    }

    public function issue(int $userId): string
    {
        $now = time();

        return JWT::encode([
            'sub' => $userId,
            'iat' => $now,
            'exp' => $now + $this->expiresIn,
        ], $this->getSecret(), 'HS256');
    }

    public function decode(string $token): stdClass
    {
        return JWT::decode($token, new Key($this->getSecret(), 'HS256'));
    }

    private function getSecret(): string
    {
        if (strlen($this->secret) < 32) {
            throw new RuntimeException('JWT_SECRET must be configured with at least 32 characters.');
        }

        return $this->secret;
    }
}
