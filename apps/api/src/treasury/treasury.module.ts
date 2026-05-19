import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChainModule } from '../chain/chain.module';
import { TreasuryController } from './treasury.controller';
import { TreasuryService } from './treasury.service';

@Module({
  imports: [ChainModule, AuthModule],
  controllers: [TreasuryController],
  providers: [TreasuryService],
  exports: [TreasuryService],
})
export class TreasuryModule {}
