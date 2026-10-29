-- CreateEnum
CREATE TYPE "Sexo" AS ENUM ('M', 'F');

-- CreateEnum
CREATE TYPE "NivelActividad" AS ENUM ('SEDENTARIO', 'LIGERO', 'MODERADO', 'INTENSO', 'MUY_INTENSO');

-- CreateEnum
CREATE TYPE "Meta" AS ENUM ('BAJAR', 'MANTENER', 'SUBIR');

-- CreateEnum
CREATE TYPE "TipoComida" AS ENUM ('DESAYUNO', 'MERIENDA_AM', 'ALMUERZO', 'MERIENDA_PM', 'CENA');

-- CreateEnum
CREATE TYPE "CategoriaAlimento" AS ENUM ('PLATO_TIPICO', 'PROTEINA', 'CEREAL_TUBERCULO', 'LEGUMINOSA', 'LACTEO', 'FRUTA', 'VERDURA', 'GRASA', 'BEBIDA');

-- CreateEnum
CREATE TYPE "EstadoPlan" AS ENUM ('BORRADOR', 'ACTIVO', 'ARCHIVADO');

-- CreateEnum
CREATE TYPE "OrigenPlan" AS ENUM ('MANUAL', 'REGLAS', 'IA');

-- CreateEnum
CREATE TYPE "EstadoCita" AS ENUM ('PROGRAMADA', 'COMPLETADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "nutricionista" (
    "id" UUID NOT NULL,
    "firebase_uid" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "colegiado" TEXT,
    "telefono" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nutricionista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paciente" (
    "id" UUID NOT NULL,
    "nutricionista_id" UUID NOT NULL,
    "firebase_uid" TEXT,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "correo" TEXT,
    "telefono" TEXT,
    "sexo" "Sexo" NOT NULL,
    "fecha_nacimiento" DATE NOT NULL,
    "nivel_actividad" "NivelActividad" NOT NULL DEFAULT 'SEDENTARIO',
    "meta" "Meta" NOT NULL DEFAULT 'MANTENER',
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicion" (
    "id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "peso_kg" DOUBLE PRECISION NOT NULL,
    "talla_cm" DOUBLE PRECISION NOT NULL,
    "pct_grasa" DOUBLE PRECISION,
    "cintura_cm" DOUBLE PRECISION,
    "notas" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medicion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restriccion" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "restriccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paciente_restriccion" (
    "paciente_id" UUID NOT NULL,
    "restriccion_id" UUID NOT NULL,

    CONSTRAINT "paciente_restriccion_pkey" PRIMARY KEY ("paciente_id","restriccion_id")
);

-- CreateTable
CREATE TABLE "cita" (
    "id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "nutricionista_id" UUID NOT NULL,
    "fecha_hora" TIMESTAMP(3) NOT NULL,
    "duracion_min" INTEGER NOT NULL DEFAULT 45,
    "motivo" TEXT,
    "estado" "EstadoCita" NOT NULL DEFAULT 'PROGRAMADA',
    "notas" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alimento" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "CategoriaAlimento" NOT NULL,
    "porcion_descripcion" TEXT NOT NULL,
    "porcion_gramos" DOUBLE PRECISION NOT NULL,
    "kcal" DOUBLE PRECISION NOT NULL,
    "proteina_g" DOUBLE PRECISION NOT NULL,
    "carbohidrato_g" DOUBLE PRECISION NOT NULL,
    "grasa_g" DOUBLE PRECISION NOT NULL,
    "fibra_g" DOUBLE PRECISION,
    "tipos_comida" "TipoComida"[],
    "contiene" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "es_tipico_hn" BOOLEAN NOT NULL DEFAULT false,
    "fuente" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "alimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_alimenticio" (
    "id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "nutricionista_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "kcal_objetivo" DOUBLE PRECISION NOT NULL,
    "proteina_g" DOUBLE PRECISION NOT NULL,
    "carbohidrato_g" DOUBLE PRECISION NOT NULL,
    "grasa_g" DOUBLE PRECISION NOT NULL,
    "estado" "EstadoPlan" NOT NULL DEFAULT 'BORRADOR',
    "origen" "OrigenPlan" NOT NULL DEFAULT 'MANUAL',
    "justificacion" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aprobado_en" TIMESTAMP(3),

    CONSTRAINT "plan_alimenticio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiempo_comida" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "tipo" "TipoComida" NOT NULL,
    "pct_kcal" DOUBLE PRECISION NOT NULL,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "tiempo_comida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_item" (
    "id" UUID NOT NULL,
    "tiempo_comida_id" UUID NOT NULL,
    "alimento_id" UUID NOT NULL,
    "porciones" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "plan_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro_comida" (
    "id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "tiempo_comida_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "cumplido" BOOLEAN NOT NULL,
    "comentario" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registro_comida_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nutricionista_firebase_uid_key" ON "nutricionista"("firebase_uid");

-- CreateIndex
CREATE UNIQUE INDEX "nutricionista_correo_key" ON "nutricionista"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "paciente_firebase_uid_key" ON "paciente"("firebase_uid");

-- CreateIndex
CREATE INDEX "paciente_nutricionista_id_activo_idx" ON "paciente"("nutricionista_id", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "paciente_nutricionista_id_correo_key" ON "paciente"("nutricionista_id", "correo");

-- CreateIndex
CREATE INDEX "medicion_paciente_id_fecha_idx" ON "medicion"("paciente_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "restriccion_codigo_key" ON "restriccion"("codigo");

-- CreateIndex
CREATE INDEX "cita_nutricionista_id_fecha_hora_idx" ON "cita"("nutricionista_id", "fecha_hora");

-- CreateIndex
CREATE INDEX "cita_paciente_id_fecha_hora_idx" ON "cita"("paciente_id", "fecha_hora");

-- CreateIndex
CREATE UNIQUE INDEX "alimento_nombre_key" ON "alimento"("nombre");

-- CreateIndex
CREATE INDEX "alimento_categoria_idx" ON "alimento"("categoria");

-- CreateIndex
CREATE INDEX "plan_alimenticio_paciente_id_estado_idx" ON "plan_alimenticio"("paciente_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "tiempo_comida_plan_id_tipo_key" ON "tiempo_comida"("plan_id", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "registro_comida_paciente_id_tiempo_comida_id_fecha_key" ON "registro_comida"("paciente_id", "tiempo_comida_id", "fecha");

-- AddForeignKey
ALTER TABLE "paciente" ADD CONSTRAINT "paciente_nutricionista_id_fkey" FOREIGN KEY ("nutricionista_id") REFERENCES "nutricionista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicion" ADD CONSTRAINT "medicion_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paciente_restriccion" ADD CONSTRAINT "paciente_restriccion_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paciente_restriccion" ADD CONSTRAINT "paciente_restriccion_restriccion_id_fkey" FOREIGN KEY ("restriccion_id") REFERENCES "restriccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cita" ADD CONSTRAINT "cita_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cita" ADD CONSTRAINT "cita_nutricionista_id_fkey" FOREIGN KEY ("nutricionista_id") REFERENCES "nutricionista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_alimenticio" ADD CONSTRAINT "plan_alimenticio_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_alimenticio" ADD CONSTRAINT "plan_alimenticio_nutricionista_id_fkey" FOREIGN KEY ("nutricionista_id") REFERENCES "nutricionista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiempo_comida" ADD CONSTRAINT "tiempo_comida_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan_alimenticio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_item" ADD CONSTRAINT "plan_item_tiempo_comida_id_fkey" FOREIGN KEY ("tiempo_comida_id") REFERENCES "tiempo_comida"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_item" ADD CONSTRAINT "plan_item_alimento_id_fkey" FOREIGN KEY ("alimento_id") REFERENCES "alimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_comida" ADD CONSTRAINT "registro_comida_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_comida" ADD CONSTRAINT "registro_comida_tiempo_comida_id_fkey" FOREIGN KEY ("tiempo_comida_id") REFERENCES "tiempo_comida"("id") ON DELETE CASCADE ON UPDATE CASCADE;
