import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * El contrato de medicamentos lo consumen el mobile y el portal desde
 * `docs/openapi.json`. Estos casos fijan lo que el documento tiene que declarar
 * para que la UI pueda reactivar una baja, limpiar dosis y avisar duplicados.
 */
interface Esquema {
  properties: Record<string, { type?: string; description?: string }>;
}

const documento = JSON.parse(
  readFileSync(new URL('../../docs/openapi.json', import.meta.url), 'utf8'),
) as {
  components: { schemas: Record<string, Esquema> };
  paths: Record<
    string,
    { get?: { parameters?: { name: string; in: string }[] } }
  >;
};

const propiedades = (nombre: string): Esquema['properties'] =>
  documento.components.schemas[nombre].properties;

describe('contrato de medicamentos en docs/openapi.json', () => {
  it('el medicamento expone la fecha del último cambio', () => {
    expect(propiedades('MedicamentoEntity').actualizadoEn).toBeDefined();
    expect(propiedades('MedicamentoEntity').creadoEn).toBeDefined();
  });

  it('el alta devuelve el aviso de duplicado sin cambiar el resto', () => {
    const aviso = propiedades('MedicamentoCreadoEntity').duplicadoDe;
    expect(aviso).toBeDefined();
    expect(propiedades('MedicamentoCreadoEntity').nombre).toBeDefined();
  });

  it('el expediente documenta el query para incluir la medicación dada de baja', () => {
    const parametros = documento.paths['/pacientes/{id}'].get?.parameters ?? [];
    expect(parametros).toContainEqual(
      expect.objectContaining({ name: 'incluirInactivos', in: 'query' }),
    );
  });
});
