-- Fecha del último cambio del medicamento.
--
-- El expediente y la ficha necesitan saber cuándo se editó o se dio de baja un
-- registro, no solo cuándo se cargó. Las filas que ya existen arrancan con la
-- fecha de la migración: no hay dato previo que reconstruir.

-- AlterTable
ALTER TABLE "medicamento" ADD COLUMN     "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
