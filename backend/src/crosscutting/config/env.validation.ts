import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

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

  // DATABASE (either DATABASE_URL or all individual vars required)
  @IsString()
  @IsOptional()
  DATABASE_URL: string;

  @IsString()
  @IsOptional()
  DATABASE_HOST: string;

  @IsNumber()
  @IsOptional()
  DATABASE_PORT: number;

  @IsString()
  @IsOptional()
  DATABASE_USERNAME: string;

  @IsString()
  @IsOptional()
  DATABASE_PASSWORD: string;

  @IsString()
  @IsOptional()
  DATABASE_NAME: string;

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

  const hasUrl = !!validatedConfig.DATABASE_URL;
  const hasIndividual =
    !!validatedConfig.DATABASE_HOST &&
    validatedConfig.DATABASE_PORT != null &&
    !!validatedConfig.DATABASE_USERNAME &&
    !!validatedConfig.DATABASE_PASSWORD &&
    !!validatedConfig.DATABASE_NAME;

  if (!hasUrl && !hasIndividual) {
    throw new Error(
      '\nDatabase config: provide DATABASE_URL or all individual vars (DATABASE_HOST, DATABASE_PORT, DATABASE_USERNAME, DATABASE_PASSWORD, DATABASE_NAME)\n',
    );
  }

  return validatedConfig;
}
