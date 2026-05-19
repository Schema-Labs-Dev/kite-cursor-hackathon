import { IsEthereumAddress, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class NonceRequestDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsString()
  @IsEthereumAddress()
  address!: string;
}
