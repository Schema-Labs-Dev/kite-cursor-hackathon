import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMeDto } from './dto/update-me.dto';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const PUBLIC_USER_SELECT = {
  id: true,
  walletAddress: true,
  basename: true,
  displayName: true,
  avatarUrl: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        walletAddress: true,
        basename: true,
        displayName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateMe(id: string, dto: UpdateMeDto) {
    try {
      return await this.prisma.user.update({
        where: { id },
        data: dto,
        select: {
          id: true,
          walletAddress: true,
          basename: true,
          displayName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          updatedAt: true,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const target = (err.meta?.target as string[] | string) ?? 'field';
        throw new ConflictException(`Already taken: ${target}`);
      }
      throw err;
    }
  }

  async resolve(q: string) {
    if (ADDRESS_RE.test(q)) {
      const user = await this.prisma.user.findUnique({
        where: { walletAddress: q.toLowerCase() },
        select: PUBLIC_USER_SELECT,
      });
      return user ? [user] : [];
    }

    return this.prisma.user.findMany({
      where: {
        OR: [
          { basename: { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 10,
      orderBy: [{ basename: 'asc' }, { displayName: 'asc' }],
      select: PUBLIC_USER_SELECT,
    });
  }
}
