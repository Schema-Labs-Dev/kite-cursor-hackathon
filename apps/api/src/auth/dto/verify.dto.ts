import { IsString, MinLength } from 'class-validator';

export class VerifySiweDto {
  @IsString()
  @MinLength(20)
  message!: string;

  @IsString()
  @MinLength(10)
  signature!: string;
}
