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
import { Transform } from 'class-transformer';

export class CreateSessionDTO {
  @IsString()
  @IsNotEmpty({ message: 'O nome da sessão é obrigatório' })
  @MinLength(3, { message: 'O nome da sessão deve ter pelo menos 3 caracteres' })
  @MaxLength(50, { message: 'O nome da sessão não deve exceder 50 caracteres' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'O nome da sessão pode conter apenas letras, números, hífens e sublinhados (underline)',
  })
  sessionName: string;

  @IsOptional()
  @IsEnum(['qrcode', 'phone'], { message: 'O modo de pareamento deve ser "qrcode" ou "phone"' })
  pairingMode?: 'qrcode' | 'phone' = 'qrcode';

  @ValidateIf((o) => o.pairingMode === 'phone')
  @IsString()
  @IsNotEmpty({
    message: 'O número de telefone é obrigatório quando o modo de pareamento é "phone"',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @Matches(/^\d{10,15}$/, {
    message: 'O número de telefone deve estar no formato internacional (ex: 5511999999999)',
  })
  phoneNumber?: string;
}
