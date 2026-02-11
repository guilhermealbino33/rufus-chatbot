import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsEnum,
  ValidateIf,
} from 'class-validator';

export class CreateSessionDTO {
  @IsString()
  @IsNotEmpty({ message: 'Session name is required' })
  @MinLength(3, { message: 'Session name must be at least 3 characters long' })
  @MaxLength(50, { message: 'Session name must not exceed 50 characters' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Session name can only contain letters, numbers, hyphens, and underscores',
  })
  sessionName: string;

  @IsOptional()
  @IsEnum(['qrcode', 'phone'], { message: 'Pairing mode must be either "qrcode" or "phone"' })
  pairingMode?: 'qrcode' | 'phone' = 'qrcode';

  @ValidateIf((o) => o.pairingMode === 'phone')
  @IsString()
  @IsNotEmpty({ message: 'Phone number is required when pairing mode is "phone"' })
  @Matches(/^\d{10,15}$/, {
    message: 'Phone number must shorten international format (e.g. 5511999999999)',
  })
  phoneNumber?: string;
}
