import { Module } from '@nestjs/common';
import { AlimentosController } from './alimentos.controller.js';
import { AlimentosService } from './alimentos.service.js';

@Module({
  controllers: [AlimentosController],
  providers: [AlimentosService],
  exports: [AlimentosService],
})
export class AlimentosModule {}
