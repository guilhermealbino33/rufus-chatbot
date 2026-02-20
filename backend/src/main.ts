import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { useContainer } from 'class-validator';
import { AppModule } from './app.module';
import { serverConfig } from './crosscutting/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const srv = app.get<ConfigType<typeof serverConfig>>(serverConfig.KEY);

  app.enableCors(
    srv.corsOrigin === true || srv.corsOrigin === undefined
      ? { origin: true }
      : { origin: srv.corsOrigin },
  );

  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableShutdownHooks();

  await app.listen(srv.port);
}

bootstrap();
