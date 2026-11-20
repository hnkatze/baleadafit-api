-- El default de la columna pasa a PENDIENTE.
--
-- La migración anterior agregó `estado` con DEFAULT 'APROBADO' a propósito: así
-- las filas que ya existían no perdían el acceso al desplegar. Pero ese default
-- quedaba fijo, y cualquier `create` futuro que olvidara el estado aprobaba el
-- perfil por omisión, que es justo lo que esta feature vino a cerrar.
--
-- Acá se cambia solo el default. Ninguna fila se toca: las que ya existen
-- conservan su 'APROBADO'. `ALTER COLUMN ... SET DEFAULT` reescribe únicamente
-- el catálogo, sin volver a la tabla.

-- AlterTable
ALTER TABLE "nutricionista" ALTER COLUMN "estado" SET DEFAULT 'PENDIENTE';
