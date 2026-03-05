import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  validateSync,
  IsNotEmpty,
  IsDefined,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
  Provision = 'provision',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  // DATABASE
  @IsString()
  @IsDefined({ message: '❌ MISSING_VAR: DATABASE_HOST' })
  @IsNotEmpty({ message: '❌ EMPTY_VAR: DATABASE_HOST' })
  DATABASE_HOST: string = undefined as any;

  @IsNumber()
  @IsDefined({ message: '❌ MISSING_VAR: DATABASE_PORT' })
  @IsNotEmpty({ message: '❌ EMPTY_VAR: DATABASE_PORT' })
  DATABASE_PORT: number = undefined as any;

  @IsString()
  @IsDefined({ message: '❌ MISSING_VAR: DATABASE_USERNAME' })
  @IsNotEmpty({ message: '❌ EMPTY_VAR: DATABASE_USERNAME' })
  DATABASE_USERNAME: string = undefined as any;

  @IsString()
  @IsDefined({ message: '❌ MISSING_VAR: DATABASE_PASSWORD' })
  @IsNotEmpty({ message: '❌ EMPTY_VAR: DATABASE_PASSWORD' })
  DATABASE_PASSWORD: string = undefined as any;

  @IsString()
  @IsDefined({ message: '❌ MISSING_VAR: DATABASE_NAME' })
  @IsNotEmpty({ message: '❌ EMPTY_VAR: DATABASE_NAME' })
  DATABASE_NAME: string = undefined as any;

  @IsString()
  @IsOptional()
  DATABASE_URL: string;

  // WHATSAPP
  @IsString()
  @IsOptional()
  WHATSAPP_TEST_PHONE_NUMBER: string;

  @IsString()
  @IsOptional()
  CHROMIUM_EXECUTABLE_PATH: string;

  @IsString()
  @IsOptional()
  WHATSAPP_PARTNER_ID: string;
}

export function validate(config: Record<string, any>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    const errorMessages = errors
      .map((error) => {
        return Object.values(error.constraints || {}).join(', ');
      })
      .join('\n');
    throw new Error(`\nStrict Environment Validation Failed:\n${errorMessages}\n`);
  }
  return validatedConfig;
}
