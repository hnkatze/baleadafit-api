import { Body, Controller, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NutricionistaEntity } from '../auth/auth.entity.js';
import type { UsuarioActual } from '../auth/auth.types.js';
import { Roles, UsuarioAct } from '../auth/decorators.js';
import { ApiSobreOk } from '../common/respuesta.js';
import { ApiErrores } from '../common/swagger.js';
import { ActualizarPerfilDto } from './mi-cuenta.dto.js';
import { MiCuentaService } from './mi-cuenta.service.js';

/**
 * Perfil propio de la nutricionista. Va aparte de `MiCuentaController` porque el
 * rol es el otro: esas rutas son del paciente.
 */
@ApiTags('mi cuenta (nutricionista)')
@ApiBearerAuth()
@Roles('nutricionista', 'nutricionista_pendiente')
@ApiErrores()
@Controller('me')
export class MiPerfilController {
  constructor(private readonly service: MiCuentaService) {}

  @Patch('perfil')
  @ApiOperation({
    summary: 'Editar mi perfil',
    description:
      'Corrige `nombre`, `telefono` y `colegiado` del perfil propio. El perfil sale del token: no hay forma de editar el de otra persona. Para limpiar `telefono` o `colegiado` hay que mandar `null`; omitirlos conserva el valor guardado y el texto vacío responde 400. `nombre` no se puede limpiar. `correo`, `estado` y `firebaseUid` no son editables: mandarlos responde 400. Un perfil `PENDIENTE` o `RECHAZADO` también puede editar el suyo.',
  })
  @ApiSobreOk(NutricionistaEntity)
  @ApiErrores(400)
  actualizar(@UsuarioAct() u: UsuarioActual, @Body() dto: ActualizarPerfilDto) {
    return this.service.actualizarPerfil(u.nutricionistaId!, dto);
  }
}
