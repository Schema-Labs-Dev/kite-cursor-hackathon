import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestUser } from '../auth/jwt.strategy';
import { AttachMemoDto } from './dto/attach-memo.dto';
import { ListTransactionsDto } from './dto/list-transactions.dto';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly txs: TransactionsService) {}

  @Get()
  async list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListTransactionsDto,
  ) {
    return this.txs.listForUser(user.id, query.cursor, query.limit);
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    const tx = await this.txs.getByIdForUser(user.id, id);
    if (!tx) throw new NotFoundException('Transaction not found');
    return tx;
  }

  @Post('memo')
  @HttpCode(202)
  async attachMemo(
    @CurrentUser() user: RequestUser,
    @Body() body: AttachMemoDto,
  ) {
    return this.txs.attachMemo(user, body);
  }
}
