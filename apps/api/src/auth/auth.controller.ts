import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { NonceRequestDto } from './dto/nonce.dto';
import { VerifySiweDto } from './dto/verify.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('nonce')
  @HttpCode(200)
  async nonce(@Body() body: NonceRequestDto) {
    return this.auth.issueNonce(body.address);
  }

  @Post('verify')
  @HttpCode(200)
  async verify(@Body() body: VerifySiweDto) {
    return this.auth.verifySiwe(body.message, body.signature);
  }
}
