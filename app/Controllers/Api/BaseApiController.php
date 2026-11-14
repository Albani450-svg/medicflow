<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Libraries\AuditLogger;
use App\Libraries\JwtTokenService;
use App\Models\UserModel;
use CodeIgniter\Model;

class BaseApiController extends BaseController
{
    protected Model $model;

    protected function currentUser(): array
    {
        $authorization = trim($this->request->getHeaderLine('Authorization'));

        if (!preg_match('/\ABearer\s+(\S+)\z/i', $authorization, $matches)) {
            throw new \LogicException('Authenticated request is missing its bearer token.');
        }

        $claims = (new JwtTokenService())->decode($matches[1]);
        $user   = (new UserModel())->find((int) $claims->sub);

        if (!is_array($user)) {
            throw new \LogicException('Authenticated user no longer exists.');
        }

        return $user;
    }

    protected function linkedProfileId(Model $profileModel, string $primaryKey): ?int
    {
        $profile = $profileModel->where('id_user', $this->currentUser()['id_user'])->first();

        if (!is_array($profile) || (int) ($profile['is_active'] ?? 1) !== 1) {
            return null;
        }

        return (int) $profile[$primaryKey];
    }

    public function index()
    {
        return $this->response->setJSON([
            'status' => true,
            'data' => $this->model->findAll()
        ]);
    }

    public function show($id)
    {
        $data = $this->model->find($id);

        if (!$data) {
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false,
                'message' => 'Data tidak ditemukan'
            ]);
        }

        return $this->response->setJSON([
            'status' => true,
            'data' => $data
        ]);
    }

    public function create()
    {
        $data = $this->request->getJSON(true);

        if (empty($data)) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false,
                'message' => 'Data tidak boleh kosong'
            ]);
        }

        $actor = $this->currentUser();
        $db = db_connect();
        $db->transBegin();

        if (!$this->model->insert($data)) {
            $db->transRollback();
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false,
                'errors' => $this->model->errors()
            ]);
        }

        try {
            $this->recordAdminMutation('create', (int) $this->model->getInsertID(), $actor);
        } catch (\RuntimeException $exception) {
            $db->transRollback();
            log_message('error', $exception->getMessage());

            return $this->response->setStatusCode(500)->setJSON([
                'status' => false,
                'message' => 'Perubahan gagal disimpan karena log aktivitas tidak dapat dibuat.',
            ]);
        }

        $db->transCommit();

        return $this->response->setStatusCode(201)->setJSON([
            'status' => true,
            'message' => 'Data berhasil ditambahkan',
            'id' => $this->model->getInsertID()
        ]);
    }

    public function update($id)
    {
        $data = $this->request->getJSON(true);

        if (empty($data)) {
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false,
                'message' => 'Data pembaruan tidak boleh kosong'
            ]);
        }

        if (!$this->model->find($id)) {
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false,
                'message' => 'Data tidak ditemukan'
            ]);
        }

        $actor = $this->currentUser();
        $db = db_connect();
        $db->transBegin();

        if (!$this->model->update($id, $data)) {
            $db->transRollback();
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false,
                'errors' => $this->model->errors()
            ]);
        }

        try {
            $this->recordAdminMutation('update', (int) $id, $actor);
        } catch (\RuntimeException $exception) {
            $db->transRollback();
            log_message('error', $exception->getMessage());

            return $this->response->setStatusCode(500)->setJSON([
                'status' => false,
                'message' => 'Perubahan gagal disimpan karena log aktivitas tidak dapat dibuat.',
            ]);
        }

        $db->transCommit();

        return $this->response->setJSON([
            'status' => true,
            'message' => 'Data berhasil diperbarui'
        ]);
    }

    public function delete($id)
    {
        if (!$this->model->find($id)) {
            return $this->response->setStatusCode(404)->setJSON([
                'status' => false,
                'message' => 'Data tidak ditemukan'
            ]);
        }

        $actor = $this->currentUser();
        $db = db_connect();
        $db->transBegin();

        if (!$this->model->delete($id)) {
            $db->transRollback();
            return $this->response->setStatusCode(400)->setJSON([
                'status' => false,
                'message' => 'Data gagal dihapus'
            ]);
        }

        try {
            $this->recordAdminMutation('delete', (int) $id, $actor);
        } catch (\RuntimeException $exception) {
            $db->transRollback();
            log_message('error', $exception->getMessage());

            return $this->response->setStatusCode(500)->setJSON([
                'status' => false,
                'message' => 'Perubahan gagal disimpan karena log aktivitas tidak dapat dibuat.',
            ]);
        }

        $db->transCommit();

        return $this->response->setJSON([
            'status' => true,
            'message' => 'Data berhasil dihapus'
        ]);
    }

    protected function recordOperationalActivity(
        string $activity,
        string $table,
        int $referenceId,
        ?string $description = null
    ): void {
        AuditLogger::record(
            (int) $this->currentUser()['id_user'],
            $activity,
            $table,
            $referenceId,
            $description
        );
    }

    private function recordAdminMutation(string $action, int $referenceId, array $actor): void
    {
        if (($actor['role'] ?? null) !== 'admin') {
            return;
        }

        $table = $this->request->getUri()->getSegment(3, 'data');
        AuditLogger::record(
            (int) $actor['id_user'],
            'Admin ' . $action,
            $table,
            $referenceId,
            'Admin ' . $action . ' data pada ' . $table . '.'
        );
    }
}