import { Module } from '@nestjs/common';
import { AlimentosModule } from '../alimentos/alimentos.module.js';
import { IaModule } from '../ia/ia.module.js';
import { PacientesModule } from '../pacientes/pacientes.module.js';
import { PlanesController } from './planes.controller.js';
import { PlanesService } from './planes.service.js';
import { RecomendadorService } from './recomendador.service.js';

@Module({
  imports: [PacientesModule, AlimentosModule, IaModule],
  controllers: [PlanesController],
  providers: [PlanesService, RecomendadorService],
  exports: [PlanesService],
})
export class PlanesModule {}
