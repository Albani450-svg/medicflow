<?php

use App\Libraries\JwtTokenService;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
final class JwtTokenServiceTest extends TestCase
{
    public function testIssuedTokenCanBeDecoded(): void
    {
        $service = new JwtTokenService(str_repeat('a', 32));
        $token   = $service->issue(42);
        $claims  = $service->decode($token);

        $this->assertSame(42, $claims->sub);
        $this->assertGreaterThan(time(), $claims->exp);
    }

    public function testSecretMustBeConfigured(): void
    {
        $service = new JwtTokenService('');

        $this->expectException(\RuntimeException::class);
        $service->issue(42);
    }
}
