import { Global, Module } from '@nestjs/common';
import { ViemService } from './viem.service';

@Global()
@Module({
  providers: [ViemService],
  exports: [ViemService],
})
export class ChainModule {}
