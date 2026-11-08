import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { UsuarioActual } from '../auth/auth.types.js';
import { Roles, UsuarioAct } from '../auth/decorators.js';
import { ApiSobreCreado, ApiSobreOk } from '../common/respuesta.js';
import { ApiErrores } from '../common/swagger.js';
import { RegistrarDispositivoDto } from './dispositivos.dto.js';
import {
  DispositivoEliminadoEntity,
  DispositivoEntity,
} from './dispositivos.entity.js';
import { DispositivosService } from './dispositivos.service.js';

const TOKEN_DISPOSITIVO = ApiParam({
  name: 'token',
  description:
    'Token de registro de FCM. Si tiene caracteres reservados de URL, mandalo con `encodeURIComponent`.',
  example: 'fMEr1:APA91bH...',
});

@ApiTags('dispositivos')
@ApiBearerAuth()
@Roles('nutricionista', 'paciente')
@ApiErrores()
@Controller('me')
export class DispositivosController {
  constructor(private readonly service: DispositivosService) {}

  @Post('dispositivos')
  @ApiOperation({
    summary: 'Registrar el dispositivo para push',
    description:
      'Guarda el token de FCM del dispositivo que hace la llamada. Es idempotente sobre el token: el primer registro responde `201` y los siguientes refrescan el mismo registro con `200`, sin duplicar. Si el token estaba en otra cuenta, pasa a esta. El dueño y el rol los pone el servidor.',
  })
  @ApiSobreCreado(
    DispositivoEntity,
    'Primer registro de este token en la cuenta.',
  )
  @ApiSobreOk(DispositivoEntity, {
    descripcion: 'El token ya existía en esta cuenta y solo se refrescó.',
  })
  @ApiErrores(400)
  async registrar(
    @UsuarioAct() u: UsuarioActual,
    @Body() dto: RegistrarDispositivoDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { dispositivo, creado } = await this.service.registrar(u, dto);
    res.status(creado ? 201 : 200);
    return dispositivo;
  }

  @Get('dispositivos')
  @ApiOperation({
    summary: 'Mis dispositivos',
    description:
      'Los dispositivos registrados por esta cuenta, el de uso más reciente primero.',
  })
  @ApiSobreOk(DispositivoEntity, { esLista: true })
  listar(@UsuarioAct() u: UsuarioActual) {
    return this.service.listar(u);
  }

  @Delete('dispositivos/:token')
  @TOKEN_DISPOSITIVO
  @ApiOperation({
    summary: 'Dar de baja un dispositivo',
    description:
      'Borra el token de esta cuenta. Sirve para cerrar sesión o cuando FCM avisa que el token ya no existe.',
  })
  @ApiSobreOk(DispositivoEliminadoEntity)
  @ApiErrores(400, 404)
  eliminar(@UsuarioAct() u: UsuarioActual, @Param('token') token: string) {
    return this.service.eliminar(u, token);
  }
}
