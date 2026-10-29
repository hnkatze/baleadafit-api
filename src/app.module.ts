import { Module } from '@nestjs/common';
import { AccesoModule } from './common/acceso.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AccesoModule,
    AuthModule,
  ],
})
export class AppModule {}
