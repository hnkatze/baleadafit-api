import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AlimentosModule } from './alimentos/alimentos.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CitasModule } from './citas/citas.module.js';
import { AccesoModule } from './common/acceso.service.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { MiCuentaModule } from './mi-cuenta/mi-cuenta.controller.js';
import { PacientesModule } from './pacientes/pacientes.module.js';
import { PlanesModule } from './planes/planes.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AccesoModule,
    AuthModule,
    DashboardModule,
    PacientesModule,
    AlimentosModule,
    PlanesModule,
    CitasModule,
    MiCuentaModule,
  ],
})
export class AppModule {}
