-- AlterTable
ALTER TABLE "plan_item" ADD COLUMN     "alimento_version_id" UUID;

-- CreateTable
CREATE TABLE "alimento_version" (
    "id" UUID NOT NULL,
    "alimento_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "tabla" TEXT NOT NULL,
    "fuente" TEXT,
    "vigente_desde" DATE NOT NULL,
    "vigente_hasta" DATE,
    "porcion_descripcion" TEXT NOT NULL,
    "porcion_gramos" DOUBLE PRECISION NOT NULL,
    "kcal" DOUBLE PRECISION NOT NULL,
    "proteina_g" DOUBLE PRECISION NOT NULL,
    "carbohidrato_g" DOUBLE PRECISION NOT NULL,
    "grasa_g" DOUBLE PRECISION NOT NULL,
    "fibra_g" DOUBLE PRECISION,
    "sodio_mg" DOUBLE PRECISION,
    "potasio_mg" DOUBLE PRECISION,
    "fosforo_mg" DOUBLE PRECISION,
    "azucares_g" DOUBLE PRECISION,
    "grasas_sat_g" DOUBLE PRECISION,
    "indice_glucemico" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alimento_version_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alimento_version_alimento_id_vigente_hasta_idx" ON "alimento_version"("alimento_id", "vigente_hasta");

-- CreateIndex
CREATE UNIQUE INDEX "alimento_version_alimento_id_version_key" ON "alimento_version"("alimento_id", "version");

-- AddForeignKey
ALTER TABLE "alimento_version" ADD CONSTRAINT "alimento_version_alimento_id_fkey" FOREIGN KEY ("alimento_id") REFERENCES "alimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_item" ADD CONSTRAINT "plan_item_alimento_version_id_fkey" FOREIGN KEY ("alimento_version_id") REFERENCES "alimento_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: cada alimento existente arranca con su versión inicial, con los
-- valores que tenía cargados al migrar.
INSERT INTO "alimento_version" (
    "id", "alimento_id", "version", "tabla", "fuente", "vigente_desde",
    "porcion_descripcion", "porcion_gramos", "kcal", "proteina_g",
    "carbohidrato_g", "grasa_g", "fibra_g", "sodio_mg", "potasio_mg",
    "fosforo_mg", "azucares_g", "grasas_sat_g", "indice_glucemico"
)
SELECT
    gen_random_uuid(), a."id", 1, 'Inicial', a."fuente", CURRENT_DATE,
    a."porcion_descripcion", a."porcion_gramos", a."kcal", a."proteina_g",
    a."carbohidrato_g", a."grasa_g", a."fibra_g", a."sodio_mg", a."potasio_mg",
    a."fosforo_mg", a."azucares_g", a."grasas_sat_g", a."indice_glucemico"
FROM "alimento" a;

-- Backfill: los ítems de planes existentes quedan atados a esa primera versión,
-- así sus totales no se mueven cuando el alimento se edite.
UPDATE "plan_item" pi
SET "alimento_version_id" = v."id"
FROM "alimento_version" v
WHERE v."alimento_id" = pi."alimento_id"
  AND v."version" = 1;
