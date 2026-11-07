import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ApiSobreCreado, ApiSobreOk } from '../common/respuesta.js';
import type { UsuarioActual } from '../auth/auth.types.js';
import { Roles, UsuarioAct } from '../auth/decorators.js';
import { PaginacionDto } from '../common/paginacion.js';
import { ApiErrores } from '../common/swagger.js';
import {
  ActualizarMedicamentoDto,
  ActualizarPacienteDto,
  BuscarPacientesDto,
  CrearMedicamentoDto,
  CrearMedicionDto,
  CrearPacienteDto,
  RegistrarComidaPacienteDto,
} from './pacientes.dto.js';
import {
  AdherenciaEntity,
  MedicamentoEntity,
  FichaPacienteEntity,
  MedicionConImcEntity,
  PacienteConCondicionesEntity,
  PacienteDetalleEntity,
  PacienteEntity,
  PacienteListadoEntity,
  RegistroComidaConTipoEntity,
  RegistroComidaEntity,
  RequerimientoEntity,
} from './pacientes.entity.js';
import { PacientesService } from './pacientes.service.js';

const ID_PACIENTE = ApiParam({
  name: 'id',
  description: 'ID del paciente',
  format: 'uuid',
});

const ID_MEDICAMENTO = ApiParam({
  name: 'id',
  description: 'ID del medicamento',
  format: 'uuid',
});

@ApiTags('pacientes')
@ApiBearerAuth()
@Roles('nutricionista')
@ApiErrores()
@Controller()
export class PacientesController {
  constructor(private readonly service: PacientesService) {}

  @Get('pacientes')
  @ApiOperation({
    summary: 'Listar pacientes',
    description:
      'Pacientes de la nutricionista con su última medición y plan activo. Busca por nombre, apellido o correo.',
  })
  @ApiSobreOk(PacienteListadoEntity, { esLista: true, paginada: true })
  listar(@UsuarioAct() u: UsuarioActual, @Query() q: BuscarPacientesDto) {
    return this.service.listar(u.nutricionistaId!, q);
  }

  @Post('pacientes')
  @ApiOperation({
    summary: 'Crear paciente',
    description:
      'Con `correo`, el paciente queda vinculado al iniciar sesión en la app con ese correo verificado.',
  })
  @ApiSobreCreado(PacienteConCondicionesEntity)
  @ApiErrores(400, 409)
  crear(@UsuarioAct() u: UsuarioActual, @Body() dto: CrearPacienteDto) {
    return this.service.crear(u.nutricionistaId!, dto);
  }

  @Get('pacientes/:id/ficha')
  @ID_PACIENTE
  @ApiOperation({
    summary: 'Ficha del paciente',
    description:
      'Todo lo que muestra la pantalla del expediente en una sola llamada: cabecera con IMC clasificado y masa magra, progreso contra el objetivo, situación clínica, hábitos, requerimiento, adherencia de los últimos 30 días, alertas calculadas por el sistema, evolución completa, consultas (pasadas con SOAP y próximas) y planes con la tabla con la que se calcularon.',
  })
  @ApiSobreOk(FichaPacienteEntity)
  @ApiErrores(404)
  ficha(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.ficha(id, u.nutricionistaId!);
  }

  @Get('pacientes/:id')
  @ID_PACIENTE
  @ApiOperation({
    summary: 'Expediente del paciente',
    description:
      'Datos clínicos y hábitos, restricciones, condiciones, medicación vigente, últimas 10 mediciones, próximas citas y planes.',
  })
  @ApiSobreOk(PacienteDetalleEntity)
  @ApiErrores(404)
  detalle(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.detalle(id, u.nutricionistaId!);
  }

  @Patch('pacientes/:id')
  @ID_PACIENTE
  @ApiOperation({
    summary: 'Actualizar paciente',
    description:
      'Si se envía `restricciones` o `condiciones`, reemplaza la lista completa de esa relación. Responde 409 si el `correo` ya lo usa otro paciente.',
  })
  @ApiSobreOk(PacienteConCondicionesEntity)
  @ApiErrores(400, 404, 409)
  actualizar(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarPacienteDto,
  ) {
    return this.service.actualizar(id, u.nutricionistaId!, dto);
  }

  @Post('pacientes/:id/medicamentos')
  @ID_PACIENTE
  @ApiOperation({
    summary: 'Registrar medicamento',
    description: 'Nombre obligatorio; dosis y frecuencia son opcionales.',
  })
  @ApiSobreCreado(MedicamentoEntity)
  @ApiErrores(400, 404)
  crearMedicamento(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CrearMedicamentoDto,
  ) {
    return this.service.crearMedicamento(id, u.nutricionistaId!, dto);
  }

  @Patch('medicamentos/:id')
  @ID_MEDICAMENTO
  @ApiOperation({
    summary: 'Editar medicamento',
    description:
      'Permite corregir los datos o marcar `activo = false` para darlo de baja.',
  })
  @ApiSobreOk(MedicamentoEntity)
  @ApiErrores(400, 404)
  actualizarMedicamento(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarMedicamentoDto,
  ) {
    return this.service.actualizarMedicamento(id, u.nutricionistaId!, dto);
  }

  @Delete('medicamentos/:id')
  @ID_MEDICAMENTO
  @ApiOperation({
    summary: 'Dar de baja un medicamento',
    description:
      'Baja lógica (`activo = false`): nunca se borra, para conservar el historial clínico.',
  })
  @ApiSobreOk(MedicamentoEntity)
  @ApiErrores(404)
  desactivarMedicamento(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.desactivarMedicamento(id, u.nutricionistaId!);
  }

  @Delete('pacientes/:id')
  @ID_PACIENTE
  @ApiOperation({
    summary: 'Dar de baja al paciente',
    description: 'Baja lógica (`activo = false`); el historial se conserva.',
  })
  @ApiSobreOk(PacienteEntity)
  @ApiErrores(404)
  desactivar(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.desactivar(id, u.nutricionistaId!);
  }

  @Get('pacientes/:id/mediciones')
  @ID_PACIENTE
  @ApiOperation({
    summary: 'Historial de mediciones',
    description: 'De la más antigua a la más reciente, con IMC.',
  })
  @ApiSobreOk(MedicionConImcEntity, { esLista: true, paginada: true })
  @ApiErrores(404)
  mediciones(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: PaginacionDto,
  ) {
    return this.service.mediciones(id, u.nutricionistaId!, q);
  }

  @Post('pacientes/:id/mediciones')
  @ID_PACIENTE
  @ApiOperation({
    summary: 'Registrar medición',
    description:
      'Peso y talla son obligatorios. Acepta composición corporal, pliegues, perímetros, presión arterial y la `fuente` del dato.',
  })
  @ApiSobreCreado(MedicionConImcEntity)
  @ApiErrores(400, 404)
  agregarMedicion(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CrearMedicionDto,
  ) {
    return this.service.agregarMedicion(id, u.nutricionistaId!, dto);
  }

  @Delete('mediciones/:id')
  @HttpCode(204)
  @ApiParam({ name: 'id', description: 'ID de la medición', format: 'uuid' })
  @ApiOperation({ summary: 'Eliminar medición' })
  @ApiNoContentResponse({ description: 'Eliminada.' })
  @ApiErrores(404)
  eliminarMedicion(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.eliminarMedicion(id, u.nutricionistaId!);
  }

  @Get('pacientes/:id/requerimiento')
  @ID_PACIENTE
  @ApiOperation({
    summary: 'Requerimiento calórico',
    description:
      'Mifflin-St Jeor con la medición más reciente × factor de actividad ± ajuste por meta. Requiere al menos una medición.',
  })
  @ApiSobreOk(RequerimientoEntity)
  @ApiErrores(400, 404)
  requerimiento(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.requerimiento(id, u.nutricionistaId!);
  }

  @Get('pacientes/:id/adherencia')
  @ID_PACIENTE
  @ApiOperation({
    summary: 'Adherencia al plan',
    description:
      'Registros del diario del paciente y porcentaje de comidas cumplidas. Por defecto, los últimos 14 días.',
  })
  @ApiQuery({
    name: 'desde',
    required: false,
    description: 'YYYY-MM-DD',
    example: '2026-10-15',
  })
  @ApiQuery({
    name: 'hasta',
    required: false,
    description: 'YYYY-MM-DD (por defecto hoy)',
    example: '2026-10-28',
  })
  @ApiSobreOk(AdherenciaEntity)
  @ApiErrores(404)
  adherencia(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.adherencia(id, u.nutricionistaId!, desde, hasta);
  }

  @Put('pacientes/:id/registros')
  @ID_PACIENTE
  @ApiOperation({
    summary: 'Marcar una comida del paciente',
    description:
      'Marca o corrige una comida del diario. Es un upsert sobre (paciente, tiempo de comida, fecha), igual que `PUT /me/registros`, y la fila queda con `autor: "NUTRICIONISTA"`.',
  })
  @ApiSobreOk(RegistroComidaEntity)
  @ApiErrores(400, 404)
  registrarComida(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegistrarComidaPacienteDto,
  ) {
    return this.service.registrarComida(id, u.nutricionistaId!, dto);
  }

  @Get('pacientes/:id/registros')
  @ID_PACIENTE
  @ApiOperation({
    summary: 'Diario de comidas del paciente',
    description:
      'Registros del periodo, del más reciente al más antiguo, con el tipo de comida y quién la marcó. Por defecto, los últimos 7 días.',
  })
  @ApiQuery({
    name: 'desde',
    required: false,
    description: 'YYYY-MM-DD',
    example: '2026-10-22',
  })
  @ApiQuery({
    name: 'hasta',
    required: false,
    description: 'YYYY-MM-DD (por defecto hoy)',
    example: '2026-10-28',
  })
  @ApiSobreOk(RegistroComidaConTipoEntity, { esLista: true, paginada: true })
  @ApiErrores(404)
  registrosDePaciente(
    @UsuarioAct() u: UsuarioActual,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: PaginacionDto,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.registrosDePaciente(
      id,
      u.nutricionistaId!,
      desde,
      hasta,
      q,
    );
  }
}
