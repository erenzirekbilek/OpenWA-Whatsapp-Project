// Serverless (Vercel) bootstrap. Mirrors main.ts's request-handling setup (body limits, helmet, CORS,
// validation, Swagger) but skips app.listen()/signal handlers/graceful-drain — a serverless invocation
// has no long-lived process to shut down, and Vercel recycles the runtime on its own schedule.
import './config/load-env';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import express, { Request, Response, NextFunction, json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { createSwaggerConfig } from './config/swagger.config';
import {
  resolveCorsPolicy,
  isSwaggerEnabled,
  isValidationErrorDetailEnabled,
  isUpgradeInsecureRequestsEnabled,
  resolveBodyLimit,
} from './config/bootstrap-security';

let cachedServer: express.Express | undefined;

export async function getServerlessApp(): Promise<express.Express> {
  if (cachedServer) {
    return cachedServer;
  }

  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), { bodyParser: false });

  const bodyLimit = resolveBodyLimit(process.env.BODY_SIZE_LIMIT);
  app.use(
    json({
      limit: bodyLimit,
      verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          mediaSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: isUpgradeInsecureRequestsEnabled(
            process.env.CSP_UPGRADE_INSECURE_REQUESTS,
            process.env.NODE_ENV,
          )
            ? []
            : null,
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const corsPolicy = resolveCorsPolicy(process.env.CORS_ORIGINS, process.env.NODE_ENV);
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      if (corsPolicy.allowAnyOrigin || corsPolicy.origins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: corsPolicy.credentials,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      disableErrorMessages: !isValidationErrorDetailEnabled(process.env.VALIDATION_ERROR_DETAIL, process.env.NODE_ENV),
    }),
  );

  if (isSwaggerEnabled(process.env.ENABLE_SWAGGER, process.env.NODE_ENV)) {
    const config = createSwaggerConfig();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.init();
  cachedServer = expressApp;
  return expressApp;
}
