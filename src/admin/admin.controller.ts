import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { SoloAdmin } from '../auth/decorators.js';
import { ApiSobreOk } from '../common/respuesta.js';
import { ApiErrores } from '../common/swagger.js';
import {
  CambiarEstadoNutricionistaDto,
  ListarNutricionistasQueryDto,
} from './admin.dto.js';
import { NutricionistaAdminEntity } from './admin.entity.js';
import { AdminService } from './admin.service.js';

const ID_NUTRICIONISTA = ApiParam({
  name: 'id',
  description: 'ID del perfil de nutricionista',
  format: 'uuid',
});

@ApiTags('admin')
@ApiBearerAuth()
@SoloAdmin()
@ApiErrores()
@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('nutricionistas')
  @ApiOperation({
    summary: 'Perfiles de nutricionista por estado',
    description:
      'Sin `estado` devuelve los `PENDIENTE`, que son los que llevan más tiempo esperando. Van del más viejo al más nuevo por `creadoEn`.',
  })
  @ApiSobreOk(NutricionistaAdminEntity, { esLista: true })
  listar(@Query() q: ListarNutricionistasQueryDto) {
    return this.service.listarNutricionistas(q);
  }

  @Patch('nutricionistas/:id/estado')
  @ID_NUTRICIONISTA
  @ApiOperation({
    summary: 'Aprobar o rechazar un perfil',
    description:
      'Con `RECHAZADO` el `motivo` es obligatorio y queda guardado en el perfil. Con `APROBADO` el motivo anterior se limpia y el `motivo` que venga en el body se ignora.',
  })
  @ApiSobreOk(NutricionistaAdminEntity)
  @ApiErrores(400, 404)
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoNutricionistaDto,
  ) {
    return this.service.cambiarEstado(id, dto);
  }
}
