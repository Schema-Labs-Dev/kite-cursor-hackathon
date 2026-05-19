import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestUser } from '../auth/jwt.strategy';
import { UpdateMeDto } from './dto/update-me.dto';
import { UsersService } from './users.service';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async getMe(@CurrentUser() user: RequestUser) {
    return this.users.getById(user.id);
  }

  @Patch()
  async updateMe(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateMeDto,
  ) {
    return this.users.updateMe(user.id, dto);
  }
}
