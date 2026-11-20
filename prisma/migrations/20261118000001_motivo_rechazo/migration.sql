-- Motivo del rechazo del perfil de nutricionista.
--
-- Sin este dato, un perfil RECHAZADO no dice por qué y la nutricionista no tiene
-- nada que corregir antes de volver a pedir la revisión. Es nullable porque solo
-- tiene sentido mientras el estado sea RECHAZADO; al aprobar se limpia.

-- AlterTable
ALTER TABLE "nutricionista" ADD COLUMN     "motivo_rechazo" TEXT;
