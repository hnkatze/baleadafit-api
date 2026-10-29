import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { FirebaseService } from './firebase.service.js';

@Module({
  controllers: [AuthController],
  providers: [FirebaseService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [FirebaseService],
})
export class AuthModule {}
