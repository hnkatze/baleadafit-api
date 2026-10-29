/** Convierte "2026-10-28" (o un ISO completo) a Date a medianoche UTC, para columnas DATE. */
export function aFecha(valor: string): Date {
  return new Date(`${valor.slice(0, 10)}T00:00:00.000Z`);
}

/** Fecha de hoy (UTC) en formato YYYY-MM-DD. */
export function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function sumarDias(fecha: Date, dias: number): Date {
  const d = new Date(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
}
