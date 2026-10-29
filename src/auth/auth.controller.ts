import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrores } from '../common/swagger.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegistroNutricionistaDto } from './auth.dto.js';
import { MeEntity, NutricionistaEntity } from './auth.entity.js';
import type { UsuarioActual } from './auth.types.js';
import { UsuarioAct } from './decorators.js';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Rol y perfil del usuario',
    description:
      'Primera llamada de la app después del login. Según `rol` muestra la navegación de nutricionista, la del paciente o el registro (`sin_perfil`).',
  })
  @ApiOkResponse({ type: MeEntity })
  @ApiErrores(401)
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

  @Post('registro-nutricionista')
  @ApiOperation({
    summary: 'Registrar nutricionista',
    description:
      'Crea el perfil de nutricionista para una cuenta de Firebase sin perfil. Usa el correo del token.',
  })
  @ApiCreatedResponse({ type: NutricionistaEntity })
  @ApiErrores(400, 401, 409)
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
