import { Module } from '@nestjs/common';
import { PacientesModule } from '../pacientes/pacientes.module.js';
import { PlanesModule } from '../planes/planes.module.js';
import { MiCuentaController } from './mi-cuenta.controller.js';
import { MiCuentaService } from './mi-cuenta.service.js';
import { MiPerfilController } from './mi-perfil.controller.js';

@Module({
  imports: [PlanesModule, PacientesModule],
  controllers: [MiCuentaController, MiPerfilController],
  providers: [MiCuentaService],
})
export class MiCuentaModule {}
