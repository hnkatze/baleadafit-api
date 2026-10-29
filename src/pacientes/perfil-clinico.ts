/**
 * Contexto del expediente que se le pasa al recomendador (IA o reglas).
 * Vive aparte para que `pacientes` y `planes` lo compartan sin importarse entre sí.
 */
export interface PerfilClinico {
  edad?: number;
  sexo?: string;
  pesoKg?: number;
  tallaCm?: number;
  imc?: number;
  pctGrasa?: number | null;
  masaMuscularKg?: number | null;
  grasaVisceral?: number | null;
  estadoFisiologico?: string;
  condiciones?: { nombre: string; descripcion?: string | null }[];
  alergias?: string | null;
  medicamentos?: string[];
  habitos?: {
    comidasAlDia?: number | null;
    aguaLitros?: number | null;
    horasSueno?: number | null;
    alcohol?: string | null;
    tabaco?: string | null;
    quienCocina?: string | null;
    presupuesto?: string | null;
  };
  objetivo?: { pesoKg?: number | null; fecha?: string | null; meta?: string };
}
