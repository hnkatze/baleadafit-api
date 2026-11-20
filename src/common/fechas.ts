/** Convierte "2026-10-28" (o un ISO completo) a Date a medianoche UTC, para columnas DATE. */
export function aFecha(valor: string): Date {
  return new Date(`${valor.slice(0, 10)}T00:00:00.000Z`);
}

/** Fecha de hoy (UTC) en formato YYYY-MM-DD. */
export function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Años cumplidos a la fecha de referencia, comparando en UTC como `aFecha`. */
export function edadEnAnios(nacimiento: Date, referencia: Date): number {
  let edad = referencia.getUTCFullYear() - nacimiento.getUTCFullYear();
  const mes = referencia.getUTCMonth() - nacimiento.getUTCMonth();
  if (mes < 0 || (mes === 0 && referencia.getUTCDate() < nacimiento.getUTCDate()))
    edad--;
  return edad;
}

export function sumarDias(fecha: Date, dias: number): Date {
  const d = new Date(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
}
