import * as express from 'express';
import { NestFactory } from '@nestjs/core';
import { config } from 'configs/env.config';
import { AppModule } from 'src/app/app.module';

let PORT: number;

async function bootstrap() {
  PORT = config.port;
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://mycleoai.xyz',
      'https://www.mycleoai.xyz',
    ],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 200,
    methods: 'GET,POST,DELETE,PATCH,PUT',
  });

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ limit: '5mb', extended: true }));

  await app.listen(PORT);
}

bootstrap()
  .then(() => console.info(`http://localhost:${PORT}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
