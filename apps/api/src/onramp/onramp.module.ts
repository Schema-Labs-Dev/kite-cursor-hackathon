import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OnrampController } from './onramp.controller';
import { OnrampService } from './onramp.service';

@Module({
  // PrismaModule + ChainModule are @Global() — no explicit import needed.
  imports: [AuthModule],
  controllers: [OnrampController],
  providers: [OnrampService],
})
export class OnrampModule {}
