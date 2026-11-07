-- CreateEnum
CREATE TYPE "AutorRegistro" AS ENUM ('PACIENTE', 'NUTRICIONISTA');

-- AlterTable
ALTER TABLE "registro_comida" ADD COLUMN     "autor" "AutorRegistro" NOT NULL DEFAULT 'PACIENTE';
