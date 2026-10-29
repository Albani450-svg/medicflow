<?php

use App\Models\NotifikasiModel;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
final class NotifikasiModelTest extends TestCase
{
    public function testNewNotificationIsAlwaysWebChannel(): void
    {
        $model = new NotifikasiModel();
        $callback = new ReflectionMethod($model, 'forceWebChannel');

        $eventData = $callback->invoke($model, [
            'data' => ['channel' => 'WhatsApp', 'pesan' => 'Test'],
        ]);

        $this->assertSame('PWA', $eventData['data']['channel']);
    }

    public function testBatchNotificationsAreAlwaysWebChannel(): void
    {
        $model = new NotifikasiModel();
        $callback = new ReflectionMethod($model, 'forceWebChannelBatch');

        $eventData = $callback->invoke($model, [
            'data' => [
                ['channel' => 'WhatsApp'],
                ['channel' => 'WhatsApp'],
            ],
        ]);

        $this->assertSame(['PWA', 'PWA'], array_column($eventData['data'], 'channel'));
    }
}
