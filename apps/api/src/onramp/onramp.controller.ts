import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestUser } from '../auth/jwt.strategy';
import { SimulateOnrampDto } from './dto/simulate-onramp.dto';
import { OnrampService } from './onramp.service';

@Controller('onramp')
@UseGuards(JwtAuthGuard)
export class OnrampController {
  constructor(private readonly onramp: OnrampService) {}

  /**
   * Simulate a Zambian payment (Airtel Money / MTN Money / Card) and mint
   * KiteUSDC or KiteEURC to the caller's smart account on Base Sepolia.
   * Returns the broadcast tx hash + the on-chain settle time so the mobile
   * UI can deep-link to BaseScan.
   */
  @Post('simulate')
  async simulate(
    @CurrentUser() user: RequestUser,
    @Body() body: SimulateOnrampDto,
  ) {
    return this.onramp.simulate(user, body);
  }
}
