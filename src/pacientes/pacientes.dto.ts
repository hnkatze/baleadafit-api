import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  EstadoFisiologico,
  FuenteMedicion,
  Meta,
  NivelActividad,
  Sexo,
} from '../generated/prisma/enums.js';

export class CrearPacienteDto {
  /** @example "Ana" */
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombre: string;

  /** @example "López" */
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  apellido: string;

  /**
   * Con este correo el paciente se vincula al iniciar sesión en la app.
   * @example "ana@correo.hn"
   */
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  correo?: string;

  /** @example "+504 9999-0000" */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  /** @example "F" */
  @IsEnum(Sexo)
  sexo: Sexo;

  /**
   * Formato YYYY-MM-DD.
   * @example "1995-04-10"
   */
  @IsDateString()
  fechaNacimiento: string;

  /**
   * Factor: sedentario 1.2, ligero 1.375, moderado 1.55, intenso 1.725, muy intenso 1.9.
   * @example "LIGERO"
   */
  @IsOptional()
  @IsEnum(NivelActividad)
  nivelActividad?: NivelActividad;

  /**
   * Ajuste calórico: bajar −500, mantener 0, subir +300.
   * @example "BAJAR"
   */
  @IsOptional()
  @IsEnum(Meta)
  meta?: Meta;

  /** @example "Prefiere cenas ligeras. Trabaja por turnos." */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notas?: string;

  /**
   * Códigos de `GET /restricciones`.
   * @example ["lactosa"]
   */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  restricciones?: string[];

  // ─── Expediente clínico ─────────────────────────────────────────────

  /**
   * Peso objetivo pactado con el paciente, en kg.
   * @example 68
   */
  @IsOptional()
  @IsNumber()
  @Min(20)
  @Max(400)
  pesoObjetivoKg?: number;

  /**
   * Formato YYYY-MM-DD.
   * @example "2027-03-01"
   */
  @IsOptional()
  @IsDateString()
  fechaObjetivo?: string;

  /**
   * Cambia el requerimiento y las recomendaciones.
   * @example "NINGUNO"
   */
  @IsOptional()
  @IsEnum(EstadoFisiologico)
  estadoFisiologico?: EstadoFisiologico;

  /** @example "Bajar de peso sin perder masa muscular" */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  motivoConsulta?: string;

  /**
   * Texto libre; complementa las restricciones del catálogo.
   * @example "Penicilina; ronchas con el marisco"
   */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  alergias?: string;

  /** @example "Apendicectomía en 2018" */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  cirugias?: string;

  /** @example "Vitamina D 1000 UI diaria" */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  suplementos?: string;

  /** @example 5 */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  comidasAlDia?: number;

  /** @example 2 */
  @IsOptional()
  @IsNumber()
  @Min(0.2)
  @Max(10)
  aguaLitros?: number;

  /** @example 7 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(24)
  horasSueno?: number;

  /** @example "1 cerveza los fines de semana" */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  alcohol?: string;

  /** @example "No fuma" */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  tabaco?: string;

  /** @example "La mamá" */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  quienCocina?: string;

  /** @example "L 1,500 semanales" */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  presupuesto?: string;

  /**
   * Códigos de `GET /condiciones`.
   * @example ["dm2", "hta"]
   */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  condiciones?: string[];
}

export class ActualizarPacienteDto extends PartialType(CrearPacienteDto) {}

export class BuscarPacientesDto {
  /**
   * Busca en nombre, apellido o correo.
   * @example "López"
   */
  @IsOptional()
  @IsString()
  q?: string;

  /** Incluir pacientes dados de baja. */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  incluirInactivos?: boolean;
}

export class CrearMedicionDto {
  /**
   * Formato YYYY-MM-DD. Por defecto, hoy.
   * @example "2026-10-28"
   */
  @IsOptional()
  @IsDateString()
  fecha?: string;

  /** @example 72.5 */
  @IsNumber()
  @Min(20)
  @Max(400)
  pesoKg: number;

  /** @example 160 */
  @IsNumber()
  @Min(80)
  @Max(250)
  tallaCm: number;

  /**
   * Porcentaje de grasa corporal.
   * @example 34
   */
  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(70)
  pctGrasa?: number;

  /** @example 88 */
  @IsOptional()
  @IsNumber()
  @Min(40)
  @Max(250)
  cinturaCm?: number;

  // ─── Composición corporal ─────────────────────────────────────────────

  /** @example 28.4 */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  masaMuscularKg?: number;

  /** @example 24.6 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  masaGrasaKg?: number;

  /**
   * Nivel que reporta el equipo (1-20).
   * @example 8
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  grasaVisceral?: number;

  /** @example 18.2 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  aguaIntracelularL?: number;

  /** @example 12.1 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  aguaExtracelularL?: number;

  /** @example 6.2 */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(15)
  anguloFase?: number;

  /** @example 18 */
  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(80)
  pliegueTricipitalMm?: number;

  /** @example 16 */
  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(80)
  pliegueSubescapularMm?: number;

  /** @example 22 */
  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(80)
  pliegueSuprailiacoMm?: number;

  /** @example 12 */
  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(80)
  pliegueBicipitalMm?: number;

  /** @example 30 */
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(200)
  perimetroBrazoCm?: number;

  /** @example 98 */
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(200)
  perimetroCaderaCm?: number;

  /** @example 55 */
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(200)
  perimetroMusloCm?: number;

  /** @example 120 */
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(250)
  presionSistolica?: number;

  /** @example 80 */
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(250)
  presionDiastolica?: number;

  /**
   * De dónde salió el dato: distingue lo medido de lo estimado.
   * @example "INBODY"
   */
  @IsOptional()
  @IsEnum(FuenteMedicion)
  fuente?: FuenteMedicion;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notas?: string;
}

export class CrearMedicamentoDto {
  /** @example "Metformina" */
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre: string;

  /** @example "500 mg" */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  dosis?: string;

  /** @example "Cada 12 horas con comida" */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  frecuencia?: string;
}

export class ActualizarMedicamentoDto extends PartialType(CrearMedicamentoDto) {
  /**
   * `false` lo saca del expediente activo sin borrar el historial.
   * @example false
   */
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
