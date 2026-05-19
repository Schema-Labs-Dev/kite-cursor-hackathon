import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestUser } from '../auth/jwt.strategy';
import { TreasuryService } from './treasury.service';

@Controller('treasury')
export class TreasuryController {
  constructor(private readonly treasury: TreasuryService) {}

  @Get('info')
  async info() {
    return this.treasury.getInfo();
  }

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  async balance(@CurrentUser() user: RequestUser) {
    return this.treasury.getBalance(user.walletAddress);
  }
}
