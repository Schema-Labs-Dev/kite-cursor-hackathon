import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AlchemyNotifyService } from './alchemy-notify.service';
import { AlchemyWebhookController } from './alchemy-webhook.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AlchemyWebhookController],
  providers: [AlchemyNotifyService],
  exports: [AlchemyNotifyService],
})
export class WebhooksModule {}
