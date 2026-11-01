import { Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiSobreCreado, ApiSobreOk } from '../common/respuesta.js';
import { Roles } from '../auth/decorators.js';
import { ApiErrores } from '../common/swagger.js';
import { BedrockService, type EstadoIa } from './bedrock.service.js';
import { EstadoIaEntity, PruebaIaEntity } from './ia.entity.js';

@ApiTags('ia')
@ApiBearerAuth()
@Roles('nutricionista')
@ApiErrores(401, 403)
@Controller('ia')
export class IaController {
  constructor(private readonly bedrock: BedrockService) {}

  @Get('estado')
  @ApiOperation({
    summary: 'Estado de la IA',
    description:
      'Indica si el recomendador usará Bedrock (`habilitado`), con qué `modelo` y `region`, y el resultado de la última llamada real (`ultimaLlamada`). Solo nutricionistas.',
  })
  @ApiSobreOk(EstadoIaEntity)
  estado(): EstadoIa {
    return this.bedrock.estado();
  }

  @Post('estado/probar')
  @ApiOperation({
    summary: 'Probar la conexión con Bedrock',
    description:
      'Envía una llamada mínima ("Responde OK", 16 tokens) para verificar credenciales, región y acceso al modelo. No lanza: si falla devuelve `ok: false` con el `error`. Solo nutricionistas.',
  })
  @ApiSobreCreado(PruebaIaEntity)
  probar(): Promise<{ ok: boolean; error?: string }> {
    return this.bedrock.probar();
  }
}
