import { IsString, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class SendMessageDTO {
  @IsString()
  @IsNotEmpty({ message: 'Session name is required' })
  @MinLength(3, { message: 'Session name must be at least 3 characters long' })
  @MaxLength(50, { message: 'Session name must not exceed 50 characters' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Session name can only contain letters, numbers, hyphens, and underscores',
  })
  sessionName: string;

  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @Matches(/^\d{10,15}$/, {
    message:
      'Phone number must contain only digits and be between 10 and 15 characters (e.g., 5511999999999)',
  })
  phone: string;

  @IsString()
  @IsNotEmpty({ message: 'Message is required' })
  @MinLength(1, { message: 'Message cannot be empty' })
  @MaxLength(4096, { message: 'Message must not exceed 4096 characters' })
  message: string;
}
