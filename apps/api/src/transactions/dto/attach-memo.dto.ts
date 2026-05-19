import {
  IsEthereumAddress,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;
const UINT_RE = /^[0-9]+$/;

export class AttachMemoDto {
  @IsString()
  @Matches(TX_HASH_RE, { message: 'txHash must be 0x-prefixed 64-hex' })
  txHash!: string;

  @IsString()
  @IsEthereumAddress()
  toAddress!: string;

  /** Raw USDC amount (uint, 6 decimals). */
  @IsString()
  @Matches(UINT_RE, { message: 'amount must be a decimal uint string' })
  @Length(1, 78)
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  memo?: string;
}
