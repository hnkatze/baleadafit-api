import { applyDecorators, type INestApplication } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiProperty,
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { MetaPaginacionEntity } from './paginacion.js';
import { CODIGOS, DetalleFallaEntity, ApiSobreFalla } from './respuesta.js';

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
    400: () => ApiSobreFalla(400, 'Datos inválidos.', CODIGOS.VALIDACION),
    401: () =>
      ApiSobreFalla(
        401,
        'Falta el token o es inválido.',
        CODIGOS.NO_AUTENTICADO,
      ),
    403: () =>
      ApiSobreFalla(
        403,
        'Sin acceso: el rol del usuario no alcanza o el correo no está verificado.',
        CODIGOS.SIN_PERMISO,
      ),
    404: () =>
      ApiSobreFalla(
        404,
        'No existe o no pertenece al usuario.',
        CODIGOS.NO_ENCONTRADO,
      ),
    409: () =>
      ApiSobreFalla(409, 'Conflicto con el estado actual.', CODIGOS.CONFLICTO),
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

### Respuestas
Todas las respuestas JSON tienen la misma forma. Éxito:

\`\`\`json
{ "ok": true, "data": { "...": "lo que devuelve el endpoint" } }
\`\`\`

Error, conservando el status HTTP (400, 401, 403, 404, 409 y 500):

\`\`\`json
{
  "ok": false,
  "error": {
    "codigo": "NO_ENCONTRADO",
    "mensaje": "Paciente no encontrado.",
    "detalles": ["sólo en fallos de validación"]
  }
}
\`\`\`

**Decidí por \`codigo\`, no por \`mensaje\`**: el mensaje es para mostrar al usuario y
puede cambiar; el código no.

| \`codigo\` | status | cuándo |
| --- | --- | --- |
| \`VALIDACION\` | 400 | falta un campo o no cumple el formato; los errores por campo vienen en \`detalles\` |
| \`NO_AUTENTICADO\` | 401 | falta el token o es inválido |
| \`SIN_PERMISO\` | 403 | el rol no alcanza, o el correo no está verificado |
| \`NO_ENCONTRADO\` | 404 | no existe, o no pertenece al usuario |
| \`CONFLICTO\` | 409 | choca con el estado actual (por ejemplo, un correo que ya usa otro paciente) |
| \`CURSOR_INVALIDO\` | 400 | el cursor no corresponde a esta lista: pedir la primera página sin cursor |
| \`ERROR_HTTP\` | 4xx | cualquier otro fallo del cliente |
| \`ERROR_INTERNO\` | 500 | el detalle queda en el log, nunca en el body |

Los documentos de Swagger (\`/docs\` y \`/docs-json\`) no llevan el sobre.

### Paginación
Las listas que crecen se paginan, y **el cliente elige el modo por query params**.
Los dos juntos responden 400 \`VALIDACION\`.

- **\`?offset=0&limit=20\`** — modo del portal, para tablas con número de página.
  \`meta\` trae \`total\` y \`hasMore\` (\`hasMore = offset + filas < total\`).
- **\`?cursor=<nextCursor>&limit=20\`** — modo de la app, para scroll infinito.
  \`meta\` trae \`nextCursor\` (\`null\` en la última página) y **no paga un COUNT**.

\`limit\` va de 1 a 100, con 20 por defecto. Sin parámetros devuelve la primera
página. Las filas van en \`data\` y la paginación en \`meta\`:

\`\`\`json
{
  "ok": true,
  "data": [],
  "meta": { "limit": 20, "offset": 0, "total": 137, "hasMore": true }
}
\`\`\`

**Paginadas**: \`/pacientes\`, \`/alimentos\`, \`/alimentos/{id}/versiones\`,
\`/citas\`, \`/pacientes/{id}/planes\`, \`/pacientes/{id}/mediciones\`,
\`/me/mediciones\`, \`/me/citas\` y \`/me/registros\`.

**No paginadas**: los catálogos fijos (\`/restricciones\`, \`/condiciones\`) y los
endpoints de detalle.

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
