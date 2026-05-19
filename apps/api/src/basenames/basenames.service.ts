import { Injectable, Logger } from '@nestjs/common';
import { parseAbi, type Address } from 'viem';
import { PrismaService } from '../prisma/prisma.service';
import { ViemService } from '../chain/viem.service';

const REGISTRAR_CONTROLLER: Address =
  '0x49aE3cC2e3AA768B1e5654f5D3C6002144A59581';

const registrarAbi = parseAbi([
  'function available(string name) view returns (bool)',
]);

export type CheckResult = {
  handle: string;
  fullName: string;
  available: boolean;
  onchain: boolean | null;
  reservedInKite: boolean;
};

@Injectable()
export class BasenamesService {
  private readonly log = new Logger(BasenamesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly viem: ViemService,
  ) {}

  async check(handle: string): Promise<CheckResult> {
    const fullName = `${handle}.base.eth`;

    const [onchainAvailable, reserved] = await Promise.all([
      this.checkOnchain(handle),
      this.prisma.user.findUnique({
        where: { basename: fullName },
        select: { id: true },
      }),
    ]);

    const reservedInKite = Boolean(reserved);
    const available =
      onchainAvailable === false ? false : !reservedInKite && onchainAvailable !== null;

    return {
      handle,
      fullName,
      available,
      onchain: onchainAvailable,
      reservedInKite,
    };
  }

  private async checkOnchain(name: string): Promise<boolean | null> {
    try {
      return (await this.viem.publicClient.readContract({
        address: REGISTRAR_CONTROLLER,
        abi: registrarAbi,
        functionName: 'available',
        args: [name],
      })) as boolean;
    } catch (err) {
      this.log.warn(
        `On-chain availability check failed for ${name}: ${(err as Error).message}`,
      );
      return null;
    }
  }
}
