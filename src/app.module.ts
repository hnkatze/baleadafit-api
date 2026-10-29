import { Module } from '@nestjs/common';
import { AccesoModule } from './common/acceso.service.js';
import { AlimentosModule } from './alimentos/alimentos.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CitasModule } from './citas/citas.module.js';
import { ConfigModule } from '@nestjs/config';
import { PacientesModule } from './pacientes/pacientes.module.js';
import { PlanesModule } from './planes/planes.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AccesoModule,
    AuthModule,
    PacientesModule,
    AlimentosModule,
    PlanesModule,
    CitasModule,
  ],
})
export class AppModule {}
