-- CreateEnum
CREATE TYPE "EstadoFisiologico" AS ENUM ('NINGUNO', 'EMBARAZO', 'LACTANCIA');

-- CreateEnum
CREATE TYPE "FuenteMedicion" AS ENUM ('MANUAL', 'BASCULA', 'INBODY', 'OMRON', 'OTRO');

-- AlterTable
ALTER TABLE "cita" ADD COLUMN     "analisis" TEXT,
ADD COLUMN     "objetivo" TEXT,
ADD COLUMN     "plan" TEXT,
ADD COLUMN     "proxima_cita_sugerida" DATE,
ADD COLUMN     "subjetivo" TEXT;

-- AlterTable
ALTER TABLE "medicion" ADD COLUMN     "agua_extracelular_l" DOUBLE PRECISION,
ADD COLUMN     "agua_intracelular_l" DOUBLE PRECISION,
ADD COLUMN     "angulo_fase" DOUBLE PRECISION,
ADD COLUMN     "fuente" "FuenteMedicion" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "grasa_visceral" INTEGER,
ADD COLUMN     "masa_grasa_kg" DOUBLE PRECISION,
ADD COLUMN     "masa_muscular_kg" DOUBLE PRECISION,
ADD COLUMN     "perimetro_brazo_cm" DOUBLE PRECISION,
ADD COLUMN     "perimetro_cadera_cm" DOUBLE PRECISION,
ADD COLUMN     "perimetro_muslo_cm" DOUBLE PRECISION,
ADD COLUMN     "pliegue_bicipital_mm" DOUBLE PRECISION,
ADD COLUMN     "pliegue_subescapular_mm" DOUBLE PRECISION,
ADD COLUMN     "pliegue_suprailiaco_mm" DOUBLE PRECISION,
ADD COLUMN     "pliegue_tricipital_mm" DOUBLE PRECISION,
ADD COLUMN     "presion_diastolica" INTEGER,
ADD COLUMN     "presion_sistolica" INTEGER;

-- AlterTable
ALTER TABLE "paciente" ADD COLUMN     "agua_litros" DOUBLE PRECISION,
ADD COLUMN     "alcohol" TEXT,
ADD COLUMN     "alergias" TEXT,
ADD COLUMN     "cirugias" TEXT,
ADD COLUMN     "comidas_al_dia" INTEGER,
ADD COLUMN     "estado_fisiologico" "EstadoFisiologico" NOT NULL DEFAULT 'NINGUNO',
ADD COLUMN     "fecha_objetivo" DATE,
ADD COLUMN     "horas_sueno" DOUBLE PRECISION,
ADD COLUMN     "motivo_consulta" TEXT,
ADD COLUMN     "peso_objetivo_kg" DOUBLE PRECISION,
ADD COLUMN     "presupuesto" TEXT,
ADD COLUMN     "quien_cocina" TEXT,
ADD COLUMN     "suplementos" TEXT,
ADD COLUMN     "tabaco" TEXT;

-- CreateTable
CREATE TABLE "condicion" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "condicion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paciente_condicion" (
    "paciente_id" UUID NOT NULL,
    "condicion_id" UUID NOT NULL,
    "notas" TEXT,

    CONSTRAINT "paciente_condicion_pkey" PRIMARY KEY ("paciente_id","condicion_id")
);

-- CreateTable
CREATE TABLE "medicamento" (
    "id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "dosis" TEXT,
    "frecuencia" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medicamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "condicion_codigo_key" ON "condicion"("codigo");

-- CreateIndex
CREATE INDEX "medicamento_paciente_id_activo_idx" ON "medicamento"("paciente_id", "activo");

-- AddForeignKey
ALTER TABLE "paciente_condicion" ADD CONSTRAINT "paciente_condicion_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paciente_condicion" ADD CONSTRAINT "paciente_condicion_condicion_id_fkey" FOREIGN KEY ("condicion_id") REFERENCES "condicion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicamento" ADD CONSTRAINT "medicamento_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
