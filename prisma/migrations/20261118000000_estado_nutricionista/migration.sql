-- Estado de aprobación del perfil de nutricionista y su edad.
--
-- Hasta acá el rol se derivaba de la existencia de la fila: registrarse era
-- tener acceso. El estado permite que el alta quede PENDIENTE y que el acceso
-- lo habilite una aprobación.
--
-- El DEFAULT 'APROBADO' es seguridad de la migración, no la regla de negocio:
-- las nutricionistas que ya existen no pierden el acceso al desplegar. El alta
-- nueva escribe 'PENDIENTE' explícito desde el controller.
--
-- fecha_nacimiento queda NULLable por la misma razón: no hay dato previo que
-- reconstruir y no se inventa una fecha de nacimiento para nadie.

-- CreateEnum
CREATE TYPE "EstadoNutricionista" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- AlterTable
ALTER TABLE "nutricionista" ADD COLUMN     "estado" "EstadoNutricionista" NOT NULL DEFAULT 'APROBADO',
ADD COLUMN     "fecha_nacimiento" DATE;
