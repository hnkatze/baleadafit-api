-- CreateEnum
CREATE TYPE "Plataforma" AS ENUM ('ANDROID', 'IOS', 'WEB');

-- CreateTable
CREATE TABLE "dispositivo" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "plataforma" "Plataforma" NOT NULL,
    "nutricionista_id" UUID,
    "paciente_id" UUID,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_uso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispositivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dispositivo_token_key" ON "dispositivo"("token");

-- CreateIndex
CREATE INDEX "dispositivo_nutricionista_id_idx" ON "dispositivo"("nutricionista_id");

-- CreateIndex
CREATE INDEX "dispositivo_paciente_id_idx" ON "dispositivo"("paciente_id");

-- AddForeignKey
ALTER TABLE "dispositivo" ADD CONSTRAINT "dispositivo_nutricionista_id_fkey" FOREIGN KEY ("nutricionista_id") REFERENCES "nutricionista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivo" ADD CONSTRAINT "dispositivo_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Un dispositivo cuelga de exactamente un perfil: ni de los dos ni de ninguno.
-- Prisma no expresa CHECK en el schema, así que vive solo acá.
ALTER TABLE "dispositivo" ADD CONSTRAINT "dispositivo_un_solo_dueno" CHECK (
    ("nutricionista_id" IS NOT NULL AND "paciente_id" IS NULL) OR
    ("nutricionista_id" IS NULL AND "paciente_id" IS NOT NULL)
);
