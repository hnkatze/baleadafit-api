import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UsuarioActual } from './auth.types.js';
import { UsuarioAct } from './decorators.js';

export class RegistroNutricionistaDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  colegiado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;
}

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Devuelve el rol y el perfil del usuario autenticado. La app decide qué navegación mostrar según `rol`. */
  @Get('me')
  async me(@UsuarioAct() u: UsuarioActual) {
    if (u.rol === 'nutricionista') {
      const perfil = await this.prisma.nutricionista.findUnique({
        where: { id: u.nutricionistaId },
      });
      return { rol: u.rol, perfil };
    }
    if (u.rol === 'paciente') {
      const perfil = await this.prisma.paciente.findUnique({
        where: { id: u.pacienteId },
        include: {
          nutricionista: { select: { nombre: true, telefono: true } },
          restricciones: { include: { restriccion: true } },
        },
      });
      return { rol: u.rol, perfil };
    }
    return { rol: u.rol, perfil: null };
  }

  /** Crea el perfil de nutricionista para una cuenta de Firebase recién registrada. */
  @Post('registro-nutricionista')
  async registrarNutricionista(
    @UsuarioAct() u: UsuarioActual,
    @Body() dto: RegistroNutricionistaDto,
  ) {
    if (u.rol !== 'sin_perfil') {
      throw new ConflictException('Esta cuenta ya tiene un perfil.');
    }
    if (!u.email)
      throw new BadRequestException('La cuenta de Firebase no tiene correo.');
    const existe = await this.prisma.nutricionista.findUnique({
      where: { correo: u.email },
    });
    if (existe)
      throw new ConflictException(
        'Ya existe una nutricionista con ese correo.',
      );
    return this.prisma.nutricionista.create({
      data: { firebaseUid: u.uid, correo: u.email, ...dto },
    });
  }
}
