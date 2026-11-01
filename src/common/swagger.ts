import { applyDecorators, type INestApplication } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiProperty,
  ApiUnauthorizedResponse,
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { MetaPaginacionEntity } from './paginacion.js';
import { DetalleFallaEntity } from './respuesta.js';

/** Formato de todos los errores de la API: el sobre de error. */
export class ErrorRespuesta {
  @ApiProperty({ example: false })
  ok: false;

  @ApiProperty({ type: () => DetalleFallaEntity })
  error: DetalleFallaEntity;
}

type CodigoError = 400 | 401 | 403 | 404 | 409;

const RESPUESTAS: Record<CodigoError, () => MethodDecorator & ClassDecorator> =
  {
    400: () =>
      ApiBadRequestResponse({
        type: ErrorRespuesta,
        description: 'Datos inválidos.',
      }),
    401: () =>
      ApiUnauthorizedResponse({
        type: ErrorRespuesta,
        description: 'Falta el token o es inválido.',
      }),
    403: () =>
      ApiForbiddenResponse({
        type: ErrorRespuesta,
        description:
          'Sin acceso: el rol del usuario no alcanza o el correo no está verificado.',
      }),
    404: () =>
      ApiNotFoundResponse({
        type: ErrorRespuesta,
        description: 'No existe o no pertenece al usuario.',
      }),
    409: () =>
      ApiConflictResponse({
        type: ErrorRespuesta,
        description: 'Conflicto con el estado actual.',
      }),
  };

/** Documenta respuestas de error. Por defecto 401 y 403 (rutas protegidas por rol). */
export const ApiErrores = (...codigos: CodigoError[]) => {
  const lista: CodigoError[] = codigos.length ? codigos : [401, 403];
  return applyDecorators(...lista.map((c) => RESPUESTAS[c]()));
};

const DESCRIPCION = `
API de **BaleadaFit**: nutrición clínica con comida hondureña.

Una sola app móvil con dos roles:
- **Nutricionista**: pacientes, mediciones, catálogo, planes y agenda.
- **Paciente**: plan del día, progreso, citas y registro de comidas (rutas \`/me\`).

### Autenticación
El API **no emite ni renueva tokens**: solo verifica el ID token de Firebase que el
cliente manda en \`Authorization: Bearer <token>\`. La cuenta la crea el cliente con el SDK
de Firebase, con **Google** o con **correo y contraseña**; para el API los dos flujos son
el mismo token.

\`GET /auth/me\` devuelve el rol (\`nutricionista\`, \`paciente\` o \`sin_perfil\`).
Una cuenta sin perfil usa \`POST /auth/registro-nutricionista\`, que **exige el correo
verificado**: con Google siempre lo está, con correo y contraseña hay que abrir el enlace
que envía Firebase. Un paciente queda vinculado automáticamente al iniciar sesión con el
correo verificado que registró su nutricionista.

Vincular Google a una cuenta de correo y contraseña es del lado del cliente
(\`linkWithPopup\`): el \`uid\` no cambia y el API no se entera.

En desarrollo, con \`AUTH_DEV_BYPASS=true\` (se ignora en producción), se acepta
\`Bearer dev:<uid>:<correo>\`.

### Recomendador
\`POST /pacientes/{id}/planes/generar\` calcula kcal y macros (Mifflin-St Jeor), pide a
AWS Bedrock una propuesta con el catálogo filtrado por restricciones y la valida
(±10 % por tiempo de comida). Si la IA no está disponible usa reglas.
`;

export function crearDocumentoOpenApi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('BaleadaFit API')
    .setDescription(DESCRIPCION)
    .setVersion('0.1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      description: 'ID token de Firebase',
    })
    .addTag('salud', 'Estado del servicio')
    .addTag('auth', 'Sesión, rol y registro de nutricionista')
    .addTag('dashboard', 'Resumen de inicio de la nutricionista')
    .addTag('pacientes', 'Expediente, mediciones, requerimiento y adherencia')
    .addTag('catálogo', 'Alimentos y restricciones')
    .addTag('planes', 'Recomendador y planes alimenticios')
    .addTag('citas', 'Agenda de la nutricionista')
    .addTag(
      'mi cuenta (paciente)',
      'Lo que ve y registra el paciente en la app',
    )
    .build();
  return SwaggerModule.createDocument(app, config, {
    extraModels: [ErrorRespuesta, DetalleFallaEntity, MetaPaginacionEntity],
    autoTagControllers: false,
  });
}

export function configurarSwagger(app: INestApplication): void {
  SwaggerModule.setup('docs', app, () => crearDocumentoOpenApi(app), {
    jsonDocumentUrl: 'docs-json',
    customSiteTitle: 'BaleadaFit API',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      tagsSorter: 'alpha',
      operationsSorter: 'method',
    },
  });
}
