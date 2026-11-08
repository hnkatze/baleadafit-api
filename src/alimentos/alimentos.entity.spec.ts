import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Contrato publicado del catálogo.
 *
 * `GET /alimentos` y `GET /alimentos/{id}` ya devuelven los nutrientes clínicos
 * (la tabla `alimento` los guarda y el servicio no recorta columnas), pero el
 * esquema de Swagger no los declaraba, así que el cliente tipado y el portal no
 * los veían. Este test fija el contrato en `docs/openapi.json`, que es el
 * artefacto que consumen los otros repos.
 */
interface Esquema {
  properties: Record<
    string,
    { type?: string; nullable?: boolean; description?: string }
  >;
}

const documento = JSON.parse(
  readFileSync(new URL('../../docs/openapi.json', import.meta.url), 'utf8'),
) as { components: { schemas: Record<string, Esquema> } };

const propiedades = (nombre: string): Esquema['properties'] =>
  documento.components.schemas[nombre].properties;

/** Nutrientes por porción con los que se verifica una condición clínica. */
const NUTRIENTES_CLINICOS = [
  'sodioMg',
  'potasioMg',
  'fosforoMg',
  'azucaresG',
  'grasasSatG',
  'indiceGlucemico',
];

describe('contrato de alimentos', () => {
  it('declara los nutrientes clínicos en el esquema que devuelven la lista y el detalle', () => {
    const declarados = Object.keys(propiedades('AlimentoEntity'));
    expect(declarados).toEqual(
      expect.arrayContaining([...NUTRIENTES_CLINICOS]),
    );
  });

  it('los declara numéricos y nullables, porque quedan nulos cuando no aplican', () => {
    const props = propiedades('AlimentoEntity');
    const formas = NUTRIENTES_CLINICOS.map((nutriente) => ({
      nutriente,
      ...props[nutriente],
    }));
    expect(formas).toEqual(
      NUTRIENTES_CLINICOS.map((nutriente) => ({
        nutriente,
        type: 'number',
        nullable: true,
        description: expect.any(String),
      })),
    );
  });

  it('sigue documentando los campos que ya tenía', () => {
    expect(Object.keys(propiedades('AlimentoEntity'))).toEqual(
      expect.arrayContaining([
        'id',
        'nombre',
        'categoria',
        'porcionDescripcion',
        'porcionGramos',
        'kcal',
        'proteinaG',
        'carbohidratoG',
        'grasaG',
        'fibraG',
        'tiposComida',
        'contiene',
        'esTipicoHn',
        'fuente',
        'activo',
      ]),
    );
  });

  it('mantiene los nutrientes en el historial de versiones', () => {
    expect(Object.keys(propiedades('AlimentoVersionEntity'))).toEqual(
      expect.arrayContaining([...NUTRIENTES_CLINICOS]),
    );
  });
});
