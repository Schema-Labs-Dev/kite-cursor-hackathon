import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { generateNonce, SiweMessage } from 'siwe';
import { PrismaService } from '../prisma/prisma.service';
import { ViemService } from '../chain/viem.service';
import { AlchemyNotifyService } from '../webhooks/alchemy-notify.service';

const NONCE_TTL_MS = 10 * 60 * 1000;
const JWT_TTL = '7d';

export interface AuthedUser {
  id: string;
  walletAddress: string;
}

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly notify: AlchemyNotifyService,
    private readonly viem: ViemService,
  ) {}

  async issueNonce(address: string): Promise<{ nonce: string; expiresAt: string }> {
    const nonce = generateNonce();
    const expiresAt = new Date(Date.now() + NONCE_TTL_MS);

    await this.prisma.authNonce.create({
      data: {
        nonce,
        address: address.toLowerCase(),
        expiresAt,
      },
    });

    return { nonce, expiresAt: expiresAt.toISOString() };
  }

  async verifySiwe(
    message: string,
    signature: string,
  ): Promise<{ token: string; user: AuthedUser }> {
    let siweMessage: SiweMessage;
    try {
      siweMessage = new SiweMessage(message);
    } catch (err) {
      this.log.warn(`Failed to parse SIWE message: ${(err as Error).message}`);
      throw new BadRequestException('Invalid SIWE message format');
    }

    // viem's `verifyMessage` handles EOA + ERC-1271 (deployed smart account)
    // + ERC-6492 (counterfactually-deployed smart account) uniformly. We need
    // ERC-6492 because the Coinbase Smart Account our mobile client uses is
    // deployed lazily on its first user-op; sign-in happens before that.
    let signatureValid = false;
    try {
      signatureValid = await this.viem.publicClient.verifyMessage({
        address: siweMessage.address as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });
    } catch (err) {
      this.log.warn(`verifyMessage threw: ${(err as Error).message}`);
    }
    if (!signatureValid) {
      throw new UnauthorizedException('SIWE signature verification failed');
    }

    const nonceRecord = await this.prisma.authNonce.findUnique({
      where: { nonce: siweMessage.nonce },
    });
    if (!nonceRecord) throw new UnauthorizedException('Unknown nonce');
    if (nonceRecord.used) throw new UnauthorizedException('Nonce already used');
    if (nonceRecord.expiresAt.getTime() < Date.now())
      throw new UnauthorizedException('Nonce expired');

    const walletAddress = siweMessage.address.toLowerCase();
    if (nonceRecord.address && nonceRecord.address !== walletAddress) {
      throw new UnauthorizedException('Nonce was issued for a different address');
    }

    await this.prisma.authNonce.update({
      where: { nonce: siweMessage.nonce },
      data: { used: true },
    });

    const existing = await this.prisma.user.findUnique({
      where: { walletAddress },
      select: { id: true, walletAddress: true },
    });
    const user =
      existing ??
      (await this.prisma.user.create({
        data: { walletAddress },
        select: { id: true, walletAddress: true },
      }));

    // Register the address with Alchemy on first sign-in so we get push
    // events for inbound USDC transfers. No-op if Notify isn't configured.
    if (!existing) {
      this.notify.addAddresses([walletAddress]).catch((err) => {
        this.log.warn(
          `Failed to register ${walletAddress} with Alchemy: ${(err as Error).message}`,
        );
      });
    }

    const token = await this.jwt.signAsync(
      { sub: user.id, address: user.walletAddress },
      { expiresIn: JWT_TTL },
    );

    return { token, user };
  }
}
