import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { CODIGOS, type CodigoFalla, type SobreFalla } from './codigos.js';

const CODIGO_POR_STATUS: Partial<Record<number, CodigoFalla>> = {
  [HttpStatus.BAD_REQUEST]: CODIGOS.VALIDACION,
  [HttpStatus.UNAUTHORIZED]: CODIGOS.NO_AUTENTICADO,
  [HttpStatus.FORBIDDEN]: CODIGOS.SIN_PERMISO,
  [HttpStatus.NOT_FOUND]: CODIGOS.NO_ENCONTRADO,
  [HttpStatus.CONFLICT]: CODIGOS.CONFLICTO,
  [HttpStatus.UNPROCESSABLE_ENTITY]: CODIGOS.VALIDACION,
};

const MENSAJE_POR_DEFECTO: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'La petición tiene datos inválidos.',
  [HttpStatus.UNAUTHORIZED]: 'Falta el token o no es válido.',
  [HttpStatus.FORBIDDEN]: 'No tenés acceso a este recurso.',
  [HttpStatus.NOT_FOUND]: 'El recurso no existe o no te pertenece.',
  [HttpStatus.CONFLICT]: 'La operación choca con el estado actual.',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Error interno del servidor.',
};

interface CuerpoNest {
  codigo?: unknown;
  mensaje?: unknown;
  detalles?: unknown;
  message?: unknown;
}

const falla = (codigo: CodigoFalla, mensaje: string): SobreFalla => ({
  ok: false,
  error: { codigo, mensaje },
});

const codigoDe = (status: number): CodigoFalla =>
  CODIGO_POR_STATUS[status] ??
  (status >= 500 ? CODIGOS.ERROR_INTERNO : CODIGOS.ERROR_HTTP);

const mensajesDe = (cuerpo: CuerpoNest): string[] => {
  if (Array.isArray(cuerpo.message)) {
    return cuerpo.message.filter((m): m is string => typeof m === 'string');
  }
  return typeof cuerpo.message === 'string' ? [cuerpo.message] : [];
};

/**
 * Traduce cualquier excepción al sobre de error, conservando el status HTTP.
 *
 * - Un `codigo` explícito en el cuerpo de la excepción gana: así los fallos con
 *   nombre propio (por ejemplo `CURSOR_INVALIDO`) no se confunden con un 400
 *   genérico.
 * - Los errores por campo quedan en `detalles`, con el primer mensaje como
 *   `mensaje` para que la UI muestre algo concreto.
 * - Un error inesperado responde 500 `ERROR_INTERNO` con mensaje genérico: el
 *   detalle va al log, nunca al cliente.
 */
export function aFalla(excepcion: unknown): {
  status: number;
  cuerpo: SobreFalla;
} {
  if (!(excepcion instanceof HttpException)) {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      cuerpo: falla(
        CODIGOS.ERROR_INTERNO,
        MENSAJE_POR_DEFECTO[HttpStatus.INTERNAL_SERVER_ERROR]!,
      ),
    };
  }

  const status = excepcion.getStatus();
  const codigo = codigoDe(status);
  const respuesta = excepcion.getResponse();

  if (typeof respuesta === 'string') {
    return { status, cuerpo: falla(codigo, respuesta) };
  }

  const cuerpo = respuesta as CuerpoNest;

  if (typeof cuerpo.codigo === 'string') {
    const detalles = Array.isArray(cuerpo.detalles)
      ? cuerpo.detalles.filter((d): d is string => typeof d === 'string')
      : [];
    return {
      status,
      cuerpo: {
        ok: false,
        error: {
          codigo: cuerpo.codigo as CodigoFalla,
          mensaje:
            typeof cuerpo.mensaje === 'string'
              ? cuerpo.mensaje
              : (MENSAJE_POR_DEFECTO[status] ?? 'La petición no se pudo completar.'),
          ...(detalles.length ? { detalles } : {}),
        },
      },
    };
  }

  const mensajes = mensajesDe(cuerpo);
  const mensaje = mensajes[0] ?? MENSAJE_POR_DEFECTO[status] ?? 'La petición no se pudo completar.';

  return {
    status,
    cuerpo: {
      ok: false,
      error: {
        codigo,
        mensaje,
        ...(mensajes.length > 1 ? { detalles: mensajes } : {}),
      },
    },
  };
}

@Catch()
export class FiltroExcepciones implements ExceptionFilter {
  private readonly logger = new Logger('Excepciones');

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const respuesta = host.switchToHttp().getResponse<Response>();
    const { status, cuerpo } = aFalla(excepcion);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        excepcion instanceof Error
          ? (excepcion.stack ?? excepcion.message)
          : String(excepcion),
      );
    }

    respuesta.status(status).json(cuerpo);
  }
}
