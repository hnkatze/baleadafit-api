import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { UsuarioActual } from '../auth/auth.types.js';
import { Roles, UsuarioAct } from '../auth/decorators.js';
import { TipoComida } from '../generated/prisma/enums.js';
import {
  ActualizarPlanDto,
  GenerarPlanDto,
  ReemplazarItemsDto,
} from './planes.dto.js';
import { PlanesService } from './planes.service.js';

@ApiTags('planes (nutricionista)')
@ApiBearerAuth()
@Roles('nutricionista')
@Controller()
export class PlanesController {
  constructor(private readonly service: PlanesService) {}

  @Get('pacientes/:id/planes')
  listar(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.listar(id, u.nutricionistaId!);
  }

  /** Recomendador híbrido: calcula kcal, Bedrock propone, el backend valida. Crea un BORRADOR. */
  @Post('pacientes/:id/planes/generar')
  generar(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerarPlanDto,
  ) {
    return this.service.generar(id, u.nutricionistaId!, dto);
  }

  @Get('planes/:id')
  detalle(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.detalle(id, u.nutricionistaId!);
  }

  @Patch('planes/:id')
  actualizar(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarPlanDto,
  ) {
    return this.service.actualizar(id, u.nutricionistaId!, dto);
  }

  @Put('planes/:id/tiempos/:tipo/items')
  reemplazarItems(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tipo', new ParseEnumPipe(TipoComida)) tipo: TipoComida,
    @Body() dto: ReemplazarItemsDto,
  ) {
    return this.service.reemplazarItems(id, tipo, u.nutricionistaId!, dto);
  }

  @Post('planes/:id/activar')
  activar(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.activar(id, u.nutricionistaId!);
  }

  @Delete('planes/:id')
  @HttpCode(204)
  eliminar(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.eliminar(id, u.nutricionistaId!);
  }
}
