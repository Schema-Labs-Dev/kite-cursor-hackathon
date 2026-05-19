import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
} from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @Length(1, 64)
  displayName?: string;

  @IsOptional()
  @IsString()
  @Length(3, 63)
  @Matches(/^[a-z0-9-]+\.base(\.eth)?$/i, {
    message: 'basename must look like name.base or name.base.eth',
  })
  basename?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @Length(10, 256)
  pushToken?: string;
}
