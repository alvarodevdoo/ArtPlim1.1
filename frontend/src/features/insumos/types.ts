/**
 * Tipos TypeScript – Módulo de Insumos
 *
 * Define as interfaces e enums usados em todo o módulo,
 * mantendo a consistência entre frontend e backend.
 */

// Espelha o enum `UnidadeBase` do Prisma
export type UnidadeBase = 'KG' | 'M2' | 'M' | 'UN' | 'LITRO';

/** Labels amigáveis para exibição nas UIs */
export const UNIDADE_BASE_LABELS: Record<UnidadeBase, string> = {
  KG: 'Quilograma (kg)',
  M2: 'Metro Quadrado (m²)',
  M: 'Metro (m)',
  UN: 'Unidade (un)',
  LITRO: 'Litro (L)',
};

/** Categorias predefinidas de insumos para a gráfica */
export const CATEGORIAS_INSUMO = [
  'Impressão 3D',
  'Chapas',
  'Rígidos',
  'Acabamentos',
  'Vinílicos',
  'Tintas e Resinas',
  'Substratos',
  'Tecidos',
  'Outros',
] as const;

export type CategoriaInsumo = typeof CATEGORIAS_INSUMO[number];

// ─── Entidade principal ───────────────────────────────────────────────────────

/** Insumo retornado pela API */
export interface Insumo {
  id: string;
  organizationId: string;
  // Campos em português (legado)
  nome: string;
  categoria: string;
  unidadeBase: string;
  /** Custo normalizado: averageCost se > 0, senão costPerUnit */
  custoUnitario: number;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  // Campos adicionais do backend (mapeados no hook)
  name?: string;
  unit?: string;
  costPerUnit?: number;
  averageCost?: number;
}

// ─── Formulário ───────────────────────────────────────────────────────────────

/** Dados do formulário de cadastro/edição */
export interface InsumoFormData {
  nome: string;
  categoria: string;
  unidadeBase: UnidadeBase;
  custoUnitario: number;
  ativo: boolean;
}

// ─── Seletor de Insumos (Orçamento) ─────────────────────────────────────────

/**
 * Representa um insumo adicionado a uma peça do orçamento.
 * Este é o objeto que o motor de cálculo (mathjs) processa.
 */
export interface InsumoMaterialSelecionado {
  /** UUID do insumo de origem */
  insumoId: string;
  /** Nome para exibição no detalhamento */
  nome: string;
  /** Custo por unidade no momento da seleção (snapshot de preço) */
  precoBase: number;
  /** Quantidade utilizada na peça (ex: 0.5 kg, 2.3 m²) */
  quantidadeUtilizada: number;
  /** Unidade base do insumo */
  unidadeBase: UnidadeBase;
  /** Variável da fórmula que este insumo preenche (para o preço/valor) */
  linkedVariable?: string;
  /** Variável da fórmula que define a quantidade deste insumo no pedido */
  linkedQuantityVariable?: string;
}

// ─── Resultado do Cálculo ─────────────────────────────────────────────────────

/** Linha do detalhamento de custo por insumo */
export interface DetalheInsumo {
  insumoId: string;
  nome: string;
  quantidade: number;
  precoBase: number;
  unidadeBase: UnidadeBase;
  /** Custo total deste insumo = quantidade × precoBase */
  subtotal: number;
  /** String da fórmula usada no mathjs (para debug/tooltip) */
  formula: string;
}

/** Resultado completo do cálculo de custo de insumos */
export interface ResultadoCustoInsumos {
  /** Soma total de todos os insumos */
  total: number;
  /** Detalhamento linha a linha (para tooltip e logs) */
  detalhamento: DetalheInsumo[];
  /** Houve erro de cálculo em algum insumo? */
  hasError: boolean;
  erros: string[];
}
