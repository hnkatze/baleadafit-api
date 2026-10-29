import { Global, Injectable, Module, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/** Verifica que los recursos pertenezcan a la nutricionista que hace la petición. */
@Injectable()
export class AccesoService {
  constructor(private readonly prisma: PrismaService) {}

  async pacienteDeNutricionista(pacienteId: string, nutricionistaId: string) {
    const paciente = await this.prisma.paciente.findFirst({
      where: { id: pacienteId, nutricionistaId },
    });
    if (!paciente) throw new NotFoundException('Paciente no encontrado.');
    return paciente;
  }

  async planDeNutricionista(planId: string, nutricionistaId: string) {
    const plan = await this.prisma.planAlimenticio.findFirst({
      where: { id: planId, nutricionistaId },
    });
    if (!plan) throw new NotFoundException('Plan no encontrado.');
    return plan;
  }
}

@Global()
@Module({ providers: [AccesoService], exports: [AccesoService] })
export class AccesoModule {}
