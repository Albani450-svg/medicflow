<?php

namespace App\Filters;

use App\Libraries\JwtTokenService;
use App\Models\UserModel;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use DomainException;
use UnexpectedValueException;

class JwtAuthFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        $authorization = trim($request->getHeaderLine('Authorization'));

        if (!preg_match('/\ABearer\s+(\S+)\z/i', $authorization, $matches)) {
            return $this->unauthorized();
        }

        try {
            $claims = (new JwtTokenService())->decode($matches[1]);
        } catch (UnexpectedValueException | DomainException) {
            return $this->unauthorized();
        }

        $userId = filter_var($claims->sub ?? null, FILTER_VALIDATE_INT);

        if ($userId === false || $userId < 1) {
            return $this->unauthorized();
        }

        $user = (new UserModel())->find($userId);

        if (!$user || (int) ($user['is_active'] ?? 0) !== 1) {
            return $this->unauthorized();
        }

        if ($arguments !== null && !in_array($user['role'] ?? null, $arguments, true)) {
            return service('response')->setStatusCode(403)->setJSON([
                'status'  => false,
                'message' => 'Role tidak memiliki akses ke endpoint ini',
            ]);
        }
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
    }

    private function unauthorized(): ResponseInterface
    {
        return service('response')
            ->setStatusCode(401)
            ->setHeader('WWW-Authenticate', 'Bearer')
            ->setJSON([
                'status'  => false,
                'message' => 'Token tidak valid atau sudah kedaluwarsa',
            ]);
    }
}
