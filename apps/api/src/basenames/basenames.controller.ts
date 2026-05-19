import {
  BadRequestException,
  Controller,
  Get,
  Param,
} from '@nestjs/common';
import { BasenamesService } from './basenames.service';

const HANDLE_RE = /^[a-z0-9-]{1,63}$/;

@Controller('basenames')
export class BasenamesController {
  constructor(private readonly basenames: BasenamesService) {}

  @Get('check/:handle')
  async check(@Param('handle') handle: string) {
    const lower = handle.toLowerCase();
    if (!HANDLE_RE.test(lower)) {
      throw new BadRequestException(
        'handle must be 1-63 chars, a-z 0-9 - only',
      );
    }
    return this.basenames.check(lower);
  }
}
