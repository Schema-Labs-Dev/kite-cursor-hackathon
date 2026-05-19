import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersPublicController {
  constructor(private readonly users: UsersService) {}

  @Get('resolve')
  async resolve(@Query('q') q: string) {
    if (!q || q.trim().length < 2) {
      throw new BadRequestException('q must be at least 2 characters');
    }
    return { results: await this.users.resolve(q.trim()) };
  }
}
