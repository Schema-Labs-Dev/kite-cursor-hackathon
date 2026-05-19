import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export type OnrampMethod = 'airtel' | 'mtn' | 'card';
export type OnrampToken = 'USDC' | 'EURC';

/** Per-tx ZMW bounds. Mirrors `MIN_ZMW` / `MAX_ZMW` on the mobile side. */
export const MIN_ZMW = 50;
export const MAX_ZMW = 5_000;

/**
 * Simulated Zambian on-ramp request. The mobile flow pretends to charge the
 * user via Airtel Money / MTN Money / card, then the backend mints real
 * KiteUSDC or KiteEURC on Base Sepolia from the deployer wallet. The
 * `claimedRate` lets us reject silently-drifting clients (>2%).
 */
export class SimulateOnrampDto {
  @IsEnum(['airtel', 'mtn', 'card'] as const)
  method!: OnrampMethod;

  @IsEnum(['USDC', 'EURC'] as const)
  token!: OnrampToken;

  @Type(() => Number)
  @IsNumber()
  @Min(MIN_ZMW)
  @Max(MAX_ZMW)
  amountKwacha!: number;

  /** Required when method is airtel | mtn. International format, 10–15 digits. */
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, {
    message: 'phone must be 10–15 digits, optional leading +',
  })
  phone?: string;

  /** Required when method is card. Just the last 4 — we never see the full PAN. */
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{4}$/, { message: 'cardLast4 must be exactly 4 digits' })
  cardLast4?: string;

  /** Optional — client's shown rate (ZMW per 1 token). Backend rejects >2% drift. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  claimedRate?: number;
}
