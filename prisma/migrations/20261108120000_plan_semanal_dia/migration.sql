-- Dimensión día del plan alimenticio.
--
-- Los planes que ya existen son de un solo día: se quedan en LUNES mediante el
-- DEFAULT, sin perder ni remapear datos. El cambio de índice único permite
-- 7 × 5 tiempos por plan sin tocar las filas actuales.

-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO');

-- AlterTable
ALTER TABLE "tiempo_comida" ADD COLUMN "dia" "DiaSemana" NOT NULL DEFAULT 'LUNES';

-- DropIndex
DROP INDEX "tiempo_comida_plan_id_tipo_key";

-- CreateIndex
CREATE UNIQUE INDEX "tiempo_comida_plan_id_dia_tipo_key" ON "tiempo_comida"("plan_id", "dia", "tipo");
