import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { networkInterfaces } from 'node:os';
import { AppModule } from './app.module';
import type { Env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error', 'debug'],
    // Needed by /webhooks/alchemy to HMAC-verify the raw payload.
    rawBody: true,
  });

  // The native mobile app makes plain fetches and isn't bound by CORS, but
  // the marketing site and Mini App (browser surfaces) are — open it up to
  // localhost + LAN IPs in any port + Expo's exp:// scheme.
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:8081',
      'http://localhost:3002',
      /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
      /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
      /^exp:\/\/.+/,
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api/v1');

  const config = app.get(ConfigService<Env, true>);
  const port = config.get('PORT', { infer: true });
  // Bind explicitly to 0.0.0.0 so physical devices on the LAN can reach us.
  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`Kite API listening on http://localhost:${port}/api/v1`);
  for (const lanUrl of lanUrls(port)) {
    logger.log(`  reachable from your phone at ${lanUrl}/api/v1`);
  }
}

function lanUrls(port: number | string): string[] {
  const urls: string[] = [];
  const ifs = networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const net of ifs[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        urls.push(`http://${net.address}:${port}`);
      }
    }
  }
  return urls;
}

bootstrap();
