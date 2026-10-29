/**
 * Datos iniciales: restricciones, condiciones clínicas y catálogo de alimentos hondureños.
 *
 * IMPORTANTE: los valores nutricionales son APROXIMADOS para desarrollo y demo.
 * Antes de uso clínico deben verificarse contra la Tabla de Composición de
 * Alimentos de Centroamérica (INCAP/OPS) o el etiquetado del producto.
 * La ampliación del catálogo (T5 / S6) usa estimaciones a partir de recetas
 * hondureñas y porciones caseras: también requiere esa verificación.
 *
 * Ejecutar: npx prisma db seed
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type {
  CategoriaAlimento,
  TipoComida,
} from '../src/generated/prisma/enums.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const FUENTE =
  'Aproximado — verificar con Tabla de Composición de Alimentos INCAP';

const restricciones = [
  { codigo: 'lactosa', nombre: 'Sin lácteos / lactosa' },
  { codigo: 'gluten', nombre: 'Sin gluten' },
  { codigo: 'huevo', nombre: 'Sin huevo' },
  { codigo: 'cerdo', nombre: 'Sin cerdo' },
  { codigo: 'mariscos', nombre: 'Sin pescados ni mariscos' },
  { codigo: 'mani', nombre: 'Sin maní' },
];

/**
 * Catálogo de condiciones clínicas. La descripción dice qué cambia en el plan,
 * que es lo que la nutricionista necesita recordar al generarlo.
 */
const condiciones = [
  {
    codigo: 'diabetes_t2',
    nombre: 'Diabetes mellitus tipo 2',
    descripcion: 'Control de carbohidratos, fibra en cada tiempo y evitar azúcares libres.',
  },
  {
    codigo: 'diabetes_t1',
    nombre: 'Diabetes mellitus tipo 1',
    descripcion: 'Conteo de carbohidratos por tiempo y horarios estables de comida.',
  },
  {
    codigo: 'prediabetes',
    nombre: 'Prediabetes',
    descripcion: 'Reducir carga glucémica y sostener el déficit calórico moderado.',
  },
  {
    codigo: 'hta',
    nombre: 'Hipertensión arterial',
    descripcion: 'Menos sodio: limitar embutidos, quesos salados y caldos concentrados.',
  },
  {
    codigo: 'dislipidemia',
    nombre: 'Dislipidemia',
    descripcion: 'Bajar grasa saturada, priorizar grasa insaturada y fibra soluble.',
  },
  {
    codigo: 'erc',
    nombre: 'Enfermedad renal crónica',
    descripcion: 'Ajustar proteína, potasio y fósforo según el estadio; requiere nefrología.',
  },
  {
    codigo: 'higado_graso',
    nombre: 'Hígado graso no alcohólico',
    descripcion: 'Déficit calórico sostenido, menos fructosa líquida y menos alcohol.',
  },
  {
    codigo: 'hipotiroidismo',
    nombre: 'Hipotiroidismo',
    descripcion: 'Vigilar yodo y fibra; el gasto energético puede estar subestimado.',
  },
  {
    codigo: 'hipertiroidismo',
    nombre: 'Hipertiroidismo',
    descripcion: 'El gasto energético puede estar sobreestimado: cuidar la pérdida de masa.',
  },
  {
    codigo: 'sop',
    nombre: 'Síndrome de ovario poliquístico',
    descripcion: 'Menor carga glucémica, proteína suficiente y actividad física regular.',
  },
  {
    codigo: 'gota',
    nombre: 'Gota / hiperuricemia',
    descripcion: 'Limitar vísceras, mariscos y cerveza; mantener hidratación alta.',
  },
  {
    codigo: 'anemia',
    nombre: 'Anemia ferropénica',
    descripcion: 'Hierro hemo con vitamina C y evitar café o té junto a la comida principal.',
  },
  {
    codigo: 'gastritis',
    nombre: 'Gastritis / reflujo',
    descripcion: 'Comidas frecuentes y pequeñas, sin frituras ni irritantes.',
  },
  {
    codigo: 'colon_irritable',
    nombre: 'Síndrome de colon irritable',
    descripcion: 'Probar tolerancia a lactosa y fibra fermentable por separado.',
  },
  {
    codigo: 'embarazo',
    nombre: 'Embarazo',
    descripcion: 'Sin déficit agresivo: sumar calorías y vigilar hierro, folato y calcio.',
  },
  {
    codigo: 'lactancia',
    nombre: 'Lactancia',
    descripcion: 'Cubrir el gasto de la producción de leche e hidratación abundante.',
  },
  {
    codigo: 'bariatrica',
    nombre: 'Post cirugía bariátrica',
    descripcion: 'Porciones pequeñas, proteína primero y suplementación indicada.',
  },
  {
    codigo: 'oncologia',
    nombre: 'Tratamiento oncológico',
    descripcion: 'Priorizar energía y proteína; adaptar texturas según tolerancia.',
  },
  {
    codigo: 'vih',
    nombre: 'VIH',
    descripcion: 'Requerimiento proteico elevado y control de infecciones alimentarias.',
  },
  {
    codigo: 'tca',
    nombre: 'Trastorno de la conducta alimentaria',
    descripcion: 'Sin énfasis en peso ni conteo estricto; coordinar con psicología.',
  },
];

// Atajos para tiempos de comida
const DES: TipoComida = 'DESAYUNO';
const MAM: TipoComida = 'MERIENDA_AM';
const ALM: TipoComida = 'ALMUERZO';
const MPM: TipoComida = 'MERIENDA_PM';
const CEN: TipoComida = 'CENA';
const MER = [MAM, MPM];

type Fila = [
  nombre: string,
  categoria: CategoriaAlimento,
  porcion: string,
  gramos: number,
  kcal: number,
  proteina: number,
  carbohidrato: number,
  grasa: number,
  tipos: TipoComida[],
  contiene?: string[],
  tipico?: boolean,
];

const alimentos: Fila[] = [
  // Platos típicos
  [
    'Baleada sencilla',
    'PLATO_TIPICO',
    '1 unidad',
    120,
    330,
    11,
    42,
    13,
    [DES, CEN],
    ['gluten', 'lactosa'],
    true,
  ],
  [
    'Baleada con huevo',
    'PLATO_TIPICO',
    '1 unidad',
    170,
    410,
    18,
    43,
    18,
    [DES, CEN],
    ['gluten', 'lactosa', 'huevo'],
    true,
  ],
  [
    'Casamiento',
    'PLATO_TIPICO',
    '1 taza',
    180,
    300,
    10,
    50,
    6,
    [DES, ALM, CEN],
    [],
    true,
  ],
  [
    'Sopa de frijoles con huevo',
    'PLATO_TIPICO',
    '1 plato',
    250,
    220,
    12,
    28,
    6,
    [ALM, CEN],
    ['huevo'],
    true,
  ],
  [
    'Sopa de res con verduras',
    'PLATO_TIPICO',
    '1 plato',
    350,
    280,
    22,
    25,
    10,
    [ALM],
    [],
    true,
  ],
  [
    'Sopa de caracol',
    'PLATO_TIPICO',
    '1 plato',
    300,
    380,
    20,
    25,
    22,
    [ALM],
    ['mariscos'],
    true,
  ],
  [
    'Pastelitos de carne',
    'PLATO_TIPICO',
    '2 unidades',
    100,
    320,
    10,
    28,
    19,
    [CEN],
    [],
    true,
  ],
  [
    'Enchiladas hondureñas',
    'PLATO_TIPICO',
    '2 unidades',
    150,
    350,
    15,
    30,
    18,
    [CEN],
    ['lactosa'],
    true,
  ],
  [
    'Tamal de cerdo',
    'PLATO_TIPICO',
    '1 unidad',
    200,
    380,
    12,
    35,
    21,
    [DES, CEN],
    ['cerdo'],
    true,
  ],
  // Proteínas
  ['Pollo a la plancha', 'PROTEINA', '90 g', 90, 150, 28, 0, 3.5, [ALM, CEN]],
  ['Pollo guisado', 'PROTEINA', '1 pieza', 120, 210, 26, 5, 9, [ALM], [], true],
  [
    'Carne asada de res',
    'PROTEINA',
    '90 g',
    90,
    200,
    24,
    0,
    11,
    [ALM, CEN],
    [],
    true,
  ],
  [
    'Chuleta de cerdo a la plancha',
    'PROTEINA',
    '90 g',
    90,
    210,
    23,
    0,
    13,
    [ALM],
    ['cerdo'],
  ],
  [
    'Tilapia frita',
    'PROTEINA',
    '1 filete',
    120,
    240,
    26,
    3,
    14,
    [ALM],
    ['mariscos'],
    true,
  ],
  [
    'Huevo revuelto',
    'PROTEINA',
    '1 unidad',
    60,
    100,
    7,
    1,
    7.5,
    [DES, CEN],
    ['huevo'],
  ],
  [
    'Huevo cocido',
    'PROTEINA',
    '1 unidad',
    50,
    78,
    6.3,
    0.6,
    5.3,
    [DES, ...MER, CEN],
    ['huevo'],
  ],
  // Leguminosas
  [
    'Frijoles rojos cocidos',
    'LEGUMINOSA',
    '1/2 taza',
    90,
    115,
    7.5,
    20,
    0.5,
    [DES, ALM, CEN],
    [],
    true,
  ],
  [
    'Frijoles fritos',
    'LEGUMINOSA',
    '1/2 taza',
    90,
    170,
    7,
    19,
    7,
    [DES, CEN],
    [],
    true,
  ],
  // Cereales y tubérculos
  [
    'Tortilla de maíz',
    'CEREAL_TUBERCULO',
    '1 unidad',
    30,
    65,
    1.7,
    13.5,
    0.8,
    [DES, ALM, CEN],
    [],
    true,
  ],
  [
    'Arroz blanco cocido',
    'CEREAL_TUBERCULO',
    '1/2 taza',
    80,
    105,
    2,
    23,
    0.2,
    [ALM, CEN],
  ],
  [
    'Plátano maduro cocido',
    'CEREAL_TUBERCULO',
    '1/2 unidad',
    80,
    100,
    1,
    26,
    0.3,
    [DES, ALM, CEN],
    [],
    true,
  ],
  [
    'Plátano maduro frito',
    'CEREAL_TUBERCULO',
    '1/2 unidad',
    80,
    190,
    1,
    30,
    8,
    [DES, ALM, CEN],
    [],
    true,
  ],
  [
    'Yuca cocida',
    'CEREAL_TUBERCULO',
    '1 taza',
    140,
    190,
    1.5,
    45,
    0.4,
    [ALM],
    [],
    true,
  ],
  [
    'Elote cocido',
    'CEREAL_TUBERCULO',
    '1 unidad',
    100,
    96,
    3.4,
    21,
    1.5,
    [ALM, ...MER],
    [],
    true,
  ],
  [
    'Pan integral',
    'CEREAL_TUBERCULO',
    '1 rebanada',
    30,
    75,
    3.5,
    13,
    1,
    [DES, ...MER],
    ['gluten'],
  ],
  [
    'Avena cocida con leche',
    'CEREAL_TUBERCULO',
    '1 taza',
    240,
    230,
    9,
    33,
    6,
    [DES],
    ['lactosa'],
  ],
  // Lácteos
  [
    'Queso seco',
    'LACTEO',
    '30 g',
    30,
    110,
    7,
    1,
    9,
    [DES, CEN],
    ['lactosa'],
    true,
  ],
  [
    'Cuajada fresca',
    'LACTEO',
    '30 g',
    30,
    60,
    5,
    1,
    4,
    [DES, CEN],
    ['lactosa'],
    true,
  ],
  [
    'Requesón',
    'LACTEO',
    '1/4 taza',
    60,
    60,
    7,
    2,
    2.5,
    [DES, ...MER, CEN],
    ['lactosa'],
    true,
  ],
  [
    'Mantequilla crema',
    'GRASA',
    '1 cucharada',
    15,
    45,
    0.5,
    1,
    4.5,
    [DES, CEN],
    ['lactosa'],
    true,
  ],
  [
    'Yogur natural',
    'LACTEO',
    '1 taza',
    245,
    150,
    8.5,
    11.4,
    8,
    [DES, ...MER],
    ['lactosa'],
  ],
  [
    'Leche semidescremada',
    'LACTEO',
    '1 taza',
    240,
    120,
    8,
    12,
    5,
    [DES, ...MER],
    ['lactosa'],
  ],
  // Frutas
  ['Banano', 'FRUTA', '1 unidad', 120, 105, 1.3, 27, 0.4, [DES, ...MER]],
  ['Mango', 'FRUTA', '1 taza', 165, 100, 1.4, 25, 0.6, [...MER]],
  ['Piña', 'FRUTA', '1 taza', 165, 82, 0.9, 22, 0.2, [...MER]],
  ['Papaya', 'FRUTA', '1 taza', 145, 62, 0.7, 16, 0.4, [DES, ...MER]],
  ['Sandía', 'FRUTA', '1 taza', 150, 46, 0.9, 11.5, 0.2, [...MER]],
  // Verduras
  [
    'Chismol',
    'VERDURA',
    '1/2 taza',
    80,
    20,
    0.8,
    4.5,
    0.2,
    [DES, ALM, CEN],
    [],
    true,
  ],
  ['Ensalada verde', 'VERDURA', '1 taza', 100, 20, 1, 4, 0.2, [ALM, CEN]],
  [
    'Ensalada de repollo con limón',
    'VERDURA',
    '1 taza',
    90,
    25,
    1,
    5,
    0.1,
    [ALM, CEN],
    [],
    true,
  ],
  [
    'Pataste cocido',
    'VERDURA',
    '1 taza',
    130,
    25,
    1,
    6,
    0.3,
    [ALM, CEN],
    [],
    true,
  ],
  // Grasas
  ['Aguacate', 'GRASA', '1/4 unidad', 50, 80, 1, 4.3, 7.3, [DES, ALM, CEN]],
  ['Maní tostado', 'GRASA', '30 g', 30, 170, 7, 6, 14, [...MER], ['mani']],
  // Bebidas
  [
    'Atol de elote',
    'BEBIDA',
    '1 taza',
    240,
    210,
    5,
    40,
    4,
    [DES, ...MER],
    ['lactosa'],
    true,
  ],
  [
    'Fresco de rosa de Jamaica sin azúcar',
    'BEBIDA',
    '1 vaso',
    250,
    5,
    0,
    1,
    0,
    [ALM, CEN, ...MER],
  ],

  // ─── Ampliación del catálogo (T5 / S6) ──────────────────────────────────
  // Las 45 filas anteriores se dejan intactas; estas 105 filas amplían el
  // catálogo a 150 alimentos. Valores estimados de recetas hondureñas y
  // porciones caseras: verificar contra INCAP antes de uso clínico.

  // Platos típicos
  ['Sopa de mondongo', 'PLATO_TIPICO', '1 plato', 350, 304, 22, 18, 16, [ALM], [], true],
  ['Pollo con tajadas', 'PLATO_TIPICO', '1 plato', 400, 538, 30, 55, 22, [ALM], [], true],
  ['Carne asada con chimol', 'PLATO_TIPICO', '1 plato', 250, 322, 28, 12, 18, [ALM, CEN], [], true],
  ['Yuca con chicharrón', 'PLATO_TIPICO', '1 plato', 250, 469, 16, 45, 25, [ALM], ['cerdo'], true],
  ['Arroz con leche', 'PLATO_TIPICO', '1 taza', 200, 252, 7, 38, 8, [DES, ...MER, CEN], ['lactosa'], true],
  ['Torrejas', 'PLATO_TIPICO', '2 unidades', 130, 298, 8, 35, 14, [DES, MPM], ['gluten', 'lactosa', 'huevo'], true],
  ['Ticucos', 'PLATO_TIPICO', '2 unidades', 150, 254, 8, 33, 10, [DES, CEN], [], true],
  ['Nacatamal', 'PLATO_TIPICO', '1 unidad', 250, 378, 14, 40, 18, [DES, ALM], ['cerdo'], true],
  ['Sopa de gallina india', 'PLATO_TIPICO', '1 plato', 350, 284, 24, 20, 12, [ALM, CEN], [], true],
  ['Sopa de pescado', 'PLATO_TIPICO', '1 plato', 350, 266, 26, 18, 10, [ALM], ['mariscos'], true],
  ['Sopa de albóndigas', 'PLATO_TIPICO', '1 plato', 350, 294, 20, 22, 14, [ALM, CEN], ['gluten'], true],
  ['Tapado olanchano', 'PLATO_TIPICO', '1 plato', 400, 424, 22, 30, 24, [ALM], ['mariscos'], true],
  ['Arroz con pollo', 'PLATO_TIPICO', '1 plato', 300, 396, 24, 48, 12, [ALM], [], true],
  ['Pollo frito con tajadas', 'PLATO_TIPICO', '1 plato', 320, 506, 28, 40, 26, [ALM], ['gluten'], true],
  ['Baleada mixta', 'PLATO_TIPICO', '1 unidad', 200, 420, 16, 44, 20, [DES, CEN], ['gluten', 'lactosa', 'cerdo'], true],
  ['Catrachas', 'PLATO_TIPICO', '2 unidades', 120, 230, 9, 26, 10, [DES, CEN], ['lactosa'], true],
  ['Tajadas con queso', 'PLATO_TIPICO', '1 plato', 180, 370, 10, 42, 18, [ALM, CEN], ['lactosa'], true],
  ['Tamal de elote', 'PLATO_TIPICO', '1 unidad', 180, 256, 6, 40, 8, [DES, CEN], ['lactosa'], true],
  ['Montucas', 'PLATO_TIPICO', '1 unidad', 200, 270, 7, 38, 10, [DES, CEN], ['cerdo'], true],
  ['Carne guisada con papa', 'PLATO_TIPICO', '1 plato', 300, 360, 26, 28, 16, [ALM, CEN], [], true],
  ['Pescado frito con tajadas', 'PLATO_TIPICO', '1 plato', 350, 478, 28, 42, 22, [ALM], ['mariscos'], true],

  // Proteínas
  ['Muslo de pollo sin piel', 'PROTEINA', '1 pieza', 90, 133, 22, 0, 5, [ALM, CEN]],
  ['Carne molida de res magra', 'PROTEINA', '90 g', 90, 165, 21, 0, 9, [ALM, CEN]],
  ['Bistec de res a la plancha', 'PROTEINA', '90 g', 90, 172, 25, 0, 8, [ALM, CEN], [], true],
  ['Lomo de cerdo asado', 'PROTEINA', '90 g', 90, 177, 24, 0, 9, [ALM], ['cerdo']],
  ['Camarones cocidos', 'PROTEINA', '100 g', 100, 93, 20, 1, 1, [ALM, CEN], ['mariscos']],
  ['Róbalo a la plancha', 'PROTEINA', '120 g', 120, 167, 26, 0, 7, [ALM], ['mariscos'], true],
  ['Sardinas en agua', 'PROTEINA', '100 g', 100, 178, 22, 0, 10, [ALM], ['mariscos']],
  ['Atún en agua', 'PROTEINA', '100 g', 100, 101, 23, 0, 1, [ALM, CEN], ['mariscos']],
  ['Jamón de pavo', 'PROTEINA', '60 g', 60, 66, 11, 2, 1.5, [DES, ...MER, CEN]],
  ['Huevo frito', 'PROTEINA', '1 unidad', 60, 111, 7, 0.5, 9, [DES, CEN], ['huevo']],
  ['Clara de huevo cocida', 'PROTEINA', '2 unidades', 70, 34, 7, 1, 0.2, [DES, ...MER, CEN], ['huevo']],

  // Cereales y tubérculos
  ['Yuca frita', 'CEREAL_TUBERCULO', '1 taza', 120, 300, 1.5, 42, 14, [ALM, CEN], [], true],
  ['Malanga cocida', 'CEREAL_TUBERCULO', '1 taza', 130, 147, 2, 34, 0.3, [ALM, CEN], [], true],
  ['Camote cocido', 'CEREAL_TUBERCULO', '1 taza', 150, 130, 2, 30, 0.2, [DES, ALM], [], true],
  ['Guineo verde cocido', 'CEREAL_TUBERCULO', '1 unidad', 120, 137, 1.5, 32, 0.3, [ALM, CEN], [], true],
  ['Tajadas de plátano verde fritas', 'CEREAL_TUBERCULO', '1 taza', 100, 292, 1.3, 38, 15, [ALM, ...MER], [], true],
  ['Arroz integral cocido', 'CEREAL_TUBERCULO', '1/2 taza', 90, 107, 2.5, 22, 1, [ALM, CEN]],
  ['Tortilla de harina de trigo', 'CEREAL_TUBERCULO', '1 unidad', 40, 119, 3, 20, 3, [DES, ...MER], ['gluten']],
  ['Pan blanco', 'CEREAL_TUBERCULO', '1 rebanada', 30, 79, 2.5, 15, 1, [DES, ...MER], ['gluten']],
  ['Elote asado', 'CEREAL_TUBERCULO', '1 unidad', 100, 120, 3.5, 22, 2, [ALM, ...MER], [], true],
  ['Papa cocida', 'CEREAL_TUBERCULO', '1 unidad', 150, 134, 3, 30, 0.2, [ALM, CEN]],
  ['Puré de papa con leche', 'CEREAL_TUBERCULO', '1 taza', 200, 198, 4, 32, 6, [ALM, CEN], ['lactosa']],
  ['Avena en hojuelas', 'CEREAL_TUBERCULO', '1/2 taza', 40, 155, 5, 27, 3, [DES, ...MER], ['gluten']],
  ['Espagueti cocido', 'CEREAL_TUBERCULO', '1 taza', 140, 189, 5, 40, 1, [ALM, CEN], ['gluten']],
  ['Tostadas de maíz', 'CEREAL_TUBERCULO', '2 unidades', 24, 89, 2, 18, 1, [DES, ALM, ...MER], [], true],

  // Leguminosas
  ['Lentejas cocidas', 'LEGUMINOSA', '1/2 taza', 100, 120, 9, 20, 0.4, [ALM, CEN]],
  ['Garbanzos cocidos', 'LEGUMINOSA', '1/2 taza', 82, 132, 7.5, 22, 1.5, [ALM, CEN]],
  ['Sopa de lentejas', 'LEGUMINOSA', '1 taza', 240, 163, 10, 24, 3, [ALM, CEN], [], true],
  ['Frijol negro cocido', 'LEGUMINOSA', '1/2 taza', 90, 115, 7.5, 20, 0.5, [DES, ALM, CEN], [], true],
  ['Frijol de soya cocido', 'LEGUMINOSA', '1/2 taza', 90, 168, 14, 10, 8, [ALM]],
  ['Frijoles con chorizo', 'LEGUMINOSA', '1/2 taza', 110, 189, 9, 18, 9, [DES, ALM], ['cerdo'], true],
  ['Sopa de habas', 'LEGUMINOSA', '1 taza', 240, 171, 10, 26, 3, [ALM, CEN], [], true],

  // Lácteos
  ['Crema hondureña', 'LACTEO', '2 cucharadas', 30, 100, 1, 1.5, 10, [DES, ALM, CEN], ['lactosa'], true],
  ['Leche entera', 'LACTEO', '1 taza', 240, 150, 8, 11.5, 8, [DES, ...MER], ['lactosa']],
  ['Leche descremada', 'LACTEO', '1 taza', 240, 84, 8, 12, 0.4, [DES, ...MER], ['lactosa']],
  ['Queso americano', 'LACTEO', '1 lonja', 20, 74, 4, 1, 6, [DES, CEN], ['lactosa']],
  ['Yogur griego natural', 'LACTEO', '1 taza', 200, 132, 17, 7, 4, [DES, ...MER], ['lactosa']],
  ['Quesillo de capas', 'LACTEO', '30 g', 30, 91, 6, 1, 7, [DES, CEN], ['lactosa'], true],
  ['Queso crema', 'LACTEO', '1 cucharada', 15, 51, 1, 0.6, 5, [DES, ...MER], ['lactosa']],

  // Frutas
  ['Zapote', 'FRUTA', '1 taza', 175, 239, 2.5, 55, 1, [...MER], [], true],
  ['Mamey', 'FRUTA', '1 taza', 175, 179, 2.5, 40, 1, [DES, ...MER], [], true],
  ['Nance', 'FRUTA', '1 taza', 110, 85, 1, 18, 1, [...MER], [], true],
  ['Jocote', 'FRUTA', '5 unidades', 100, 87, 1, 20, 0.3, [...MER], [], true],
  ['Marañón fresco (fruta)', 'FRUTA', '1 taza', 120, 89, 1.2, 20, 0.5, [...MER], [], true],
  ['Mango verde con sal', 'FRUTA', '1 taza', 150, 67, 1, 15, 0.3, [...MER], [], true],
  ['Melón', 'FRUTA', '1 taza', 160, 62, 0.9, 14, 0.3, [DES, ...MER]],
  ['Naranja', 'FRUTA', '1 unidad', 140, 67, 1.3, 15, 0.2, [DES, ...MER]],
  ['Mandarina', 'FRUTA', '1 unidad', 80, 44, 0.6, 10, 0.2, [...MER]],
  ['Uva', 'FRUTA', '1 taza', 150, 115, 1, 27, 0.3, [...MER]],
  ['Guayaba', 'FRUTA', '1 unidad', 100, 75, 2.5, 14, 1, [...MER], [], true],
  ['Fresa', 'FRUTA', '1 taza', 150, 53, 1, 11, 0.5, [...MER]],
  ['Pitahaya', 'FRUTA', '1 unidad', 200, 103, 2, 22, 0.8, [...MER], [], true],

  // Verduras
  ['Ayote cocido', 'VERDURA', '1 taza', 160, 56, 1.2, 12, 0.3, [ALM, CEN], [], true],
  ['Loroco', 'VERDURA', '1/2 taza', 50, 31, 2.5, 4, 0.5, [DES, ALM], [], true],
  ['Chipilín', 'VERDURA', '1/2 taza', 50, 25, 2.5, 3, 0.3, [ALM, CEN], [], true],
  ['Ejotes cocidos', 'VERDURA', '1 taza', 125, 47, 2.4, 9, 0.2, [ALM, CEN]],
  ['Rábano', 'VERDURA', '1 taza', 120, 20, 0.8, 4, 0.1, [ALM, CEN]],
  ['Zanahoria cocida', 'VERDURA', '1 taza', 155, 59, 1.2, 13, 0.2, [ALM, CEN]],
  ['Repollo cocido', 'VERDURA', '1 taza', 150, 39, 1.5, 8, 0.1, [ALM, CEN]],
  ['Tomate', 'VERDURA', '1 unidad', 120, 26, 1, 5, 0.2, [DES, ALM, CEN]],
  ['Pepino con limón', 'VERDURA', '1 taza', 130, 21, 0.8, 4, 0.2, [ALM, ...MER, CEN]],
  ['Chayote cocido', 'VERDURA', '1 taza', 160, 39, 1.2, 8, 0.2, [ALM, CEN]],
  ['Espinaca', 'VERDURA', '1 taza', 30, 9, 0.9, 1.1, 0.1, [ALM, CEN]],
  ['Brócoli cocido', 'VERDURA', '1 taza', 155, 64, 3.7, 11, 0.6, [ALM, CEN]],

  // Grasas
  ['Coco fresco rallado', 'GRASA', '1/2 taza', 40, 156, 1.5, 6, 14, [DES, ...MER], [], true],
  ['Marañón tostado', 'GRASA', '30 g', 30, 173, 5, 9, 13, [...MER], [], true],
  ['Semillas de girasol', 'GRASA', '30 g', 30, 183, 6, 6, 15, [...MER]],
  ['Semillas de chía', 'GRASA', '2 cucharadas', 24, 128, 4, 10, 8, [DES, ...MER]],
  ['Manteca de cerdo', 'GRASA', '1 cucharada', 13, 117, 0, 0, 13, [ALM, CEN], ['cerdo'], true],
  ['Aceite vegetal', 'GRASA', '1 cucharada', 14, 126, 0, 0, 14, [ALM, CEN]],
  ['Mayonesa', 'GRASA', '1 cucharada', 14, 102, 0.2, 0.5, 11, [ALM, CEN], ['huevo']],

  // Bebidas
  ['Café de Marcala sin azúcar', 'BEBIDA', '1 taza', 240, 3, 0.3, 0.5, 0, [DES, ...MER], [], true],
  ['Café con leche', 'BEBIDA', '1 taza', 240, 58, 4, 6, 2, [DES, ...MER], ['lactosa'], true],
  ['Horchata', 'BEBIDA', '1 vaso', 250, 186, 3, 30, 6, [ALM, ...MER, CEN], ['lactosa'], true],
  ['Fresco de rosa de Jamaica con azúcar', 'BEBIDA', '1 vaso', 250, 96, 0, 24, 0, [ALM, ...MER, CEN], [], true],
  ['Pozol', 'BEBIDA', '1 taza', 240, 197, 4, 34, 5, [DES, ...MER], ['lactosa'], true],
  ['Agua de coco', 'BEBIDA', '1 vaso', 240, 47, 1.5, 9, 0.5, [ALM, ...MER], [], true],
  ['Fresco de tamarindo sin azúcar', 'BEBIDA', '1 vaso', 250, 51, 0.3, 12, 0.2, [ALM, ...MER, CEN], [], true],
  ['Jugo de naranja natural', 'BEBIDA', '1 vaso', 250, 98, 1.5, 22, 0.4, [DES, ...MER]],
  ['Fresco de melón', 'BEBIDA', '1 vaso', 250, 62, 0.8, 14, 0.3, [...MER]],
  ['Licuado de banano con leche', 'BEBIDA', '1 vaso', 300, 206, 8, 30, 6, [DES, ...MER], ['lactosa'], true],
  ['Batido de mango con leche', 'BEBIDA', '1 vaso', 300, 201, 7, 32, 5, [DES, ...MER], ['lactosa'], true],
  ['Jugo de zanahoria', 'BEBIDA', '1 vaso', 250, 74, 1.5, 16, 0.4, [...MER]],
  ['Atol de plátano', 'BEBIDA', '1 taza', 240, 197, 4, 34, 5, [DES, ...MER], ['lactosa'], true],
];

// ─── Validación de coherencia de macros ──────────────────────────────────
// Tolerancia del 15 % entre las kcal declaradas y el cálculo 4·P + 4·C + 9·G.
// El piso absoluto de 20 kcal evita falsos positivos por redondeo en porciones
// muy pequeñas (p. ej. una bebida sin azúcar de 5 kcal).
const TOLERANCIA_RELATIVA = 0.15;
const TOLERANCIA_ABSOLUTA_KCAL = 20;

function validarCoherencia(lista: Fila[]) {
  const codigosRestriccion = new Set(restricciones.map((r) => r.codigo));
  const problemas: string[] = [];

  for (const [
    nombre,
    ,
    ,
    ,
    kcal,
    proteinaG,
    carbohidratoG,
    grasaG,
    ,
    contiene = [],
  ] of lista) {
    const calculado = 4 * proteinaG + 4 * carbohidratoG + 9 * grasaG;
    const diferencia = Math.abs(calculado - kcal);
    const desvio = kcal === 0 ? 0 : diferencia / kcal;

    if (desvio > TOLERANCIA_RELATIVA && diferencia > TOLERANCIA_ABSOLUTA_KCAL) {
      problemas.push(
        `${nombre}: ${kcal} kcal declaradas vs ${calculado.toFixed(1)} kcal calculadas (${(desvio * 100).toFixed(1)} % de desvío)`,
      );
    }

    for (const etiqueta of contiene) {
      if (!codigosRestriccion.has(etiqueta)) {
        problemas.push(
          `${nombre}: etiqueta "${etiqueta}" no corresponde a ninguna restricción`,
        );
      }
    }
  }

  if (problemas.length > 0) {
    throw new Error(
      `Catálogo incoherente (${problemas.length} problema(s)):\n  - ${problemas.join('\n  - ')}`,
    );
  }
}

function resumenPorCategoria(lista: Fila[]) {
  const conteo = new Map<string, number>();
  for (const [, categoria] of lista) {
    conteo.set(categoria, (conteo.get(categoria) ?? 0) + 1);
  }
  return [...conteo.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([categoria, total]) => `  ${categoria}: ${total}`)
    .join('\n');
}

async function main() {
  // Falla antes de escribir nada si alguna fila tiene macros incoherentes.
  validarCoherencia(alimentos);

  for (const r of restricciones) {
    await prisma.restriccion.upsert({
      where: { codigo: r.codigo },
      create: r,
      update: { nombre: r.nombre },
    });
  }

  for (const c of condiciones) {
    await prisma.condicion.upsert({
      where: { codigo: c.codigo },
      create: c,
      update: { nombre: c.nombre, descripcion: c.descripcion },
    });
  }

  for (const [
    nombre,
    categoria,
    porcionDescripcion,
    porcionGramos,
    kcal,
    proteinaG,
    carbohidratoG,
    grasaG,
    tiposComida,
    contiene = [],
    esTipicoHn = false,
  ] of alimentos) {
    const data = {
      categoria,
      porcionDescripcion,
      porcionGramos,
      kcal,
      proteinaG,
      carbohidratoG,
      grasaG,
      tiposComida,
      contiene,
      esTipicoHn,
      fuente: FUENTE,
    };
    await prisma.alimento.upsert({
      where: { nombre },
      create: { nombre, ...data },
      update: data,
    });
  }

  const tipicos = alimentos.filter(([, , , , , , , , , , tipico]) => tipico === true).length;

  console.log(
    `Seed listo: ${restricciones.length} restricciones, ${condiciones.length} condiciones, ${alimentos.length} alimentos.`,
  );
  console.log(`Conteo por categoría:\n${resumenPorCategoria(alimentos)}`);
  console.log(`Marcados como típicos hondureños: ${tipicos}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
