/**
 * calcularCustoInsumos – Motor de Cálculo com mathjs
 *
 * Esta função é o coração do módulo de orçamentos dinâmicos.
 * Recebe um array de materiais selecionados pelo usuário e:
 *
 * 1. Para cada material, monta uma string de fórmula no formato:
 *       "(quantidadeUtilizada * precoBase)"
 *
 * 2. Avalia cada fórmula individualmente com mathjs (seguro, sem eval())
 *
 * 3. Soma todos os subtotais para obter o custo total
 *
 * 4. Retorna o total + detalhamento por linha (para exibição em tooltip)
 *
 * Dependência: mathjs (já presente no projeto – ver package.json)
 */

import { create, all } from 'mathjs';
import {
  InsumoMaterialSelecionado,
  DetalheInsumo,
  ResultadoCustoInsumos,
} from './types';

// Instância configurada do mathjs
// Usamos `create(all)` para ter acesso a todas as funções,
// mas avaliamos apenas expressões numéricas simples.
const math = create(all, {
  // Precisão extra para não acumular erros de ponto flutuante
  number: 'BigNumber',
  precision: 20,
});

/**
 * Calcula o custo total de um conjunto de insumos selecionados.
 *
 * @param materiais - Array de insumos adicionados ao orçamento (estado do SeletorInsumos)
 * @returns ResultadoCustoInsumos com total, detalhamento e eventuais erros
 *
 * @example
 * const resultado = calcularCustoInsumos([
 *   { insumoId: '1', nome: 'Filamento PLA', precoBase: 89.90, quantidadeUtilizada: 0.5, unidadeBase: 'KG' },
 *   { insumoId: '2', nome: 'Chapa MDF 3mm', precoBase: 45.00, quantidadeUtilizada: 2.0, unidadeBase: 'M2' },
 * ]);
 * // resultado.total = 134.95
 * // resultado.detalhamento[0].subtotal = 44.95   (0.5 × 89.90)
 * // resultado.detalhamento[1].subtotal = 90.00   (2.0 × 45.00)
 */
export function calcularCustoInsumos(
  materiais: InsumoMaterialSelecionado[],
  variableValues: Record<string, any> = {},
): ResultadoCustoInsumos {
  // Sem materiais → custo zero
  if (!materiais || materiais.length === 0) {
    return { total: 0, detalhamento: [], hasError: false, erros: [] };
  }

  const detalhamento: DetalheInsumo[] = [];
  const erros: string[] = [];
  let totalAcumulado = 0;

  // ── Iteração sobre cada material ────────────────────────────────────────────
  materiais.forEach((material) => {
    // ① Determina a quantidade real (estática ou dinâmica via variável ou padrão inteligente)
    let qtdEfetiva = material.quantidadeUtilizada;
    let isDynamic = false;

    if (material.linkedQuantityVariable && variableValues[material.linkedQuantityVariable] !== undefined) {
      qtdEfetiva = Number(variableValues[material.linkedQuantityVariable]) || 0;
      isDynamic = true;
    } else {
      // PADRÕES INTELIGENTES: Se a unidade do material for área ou linear, e houver cálculo na regra
      const unit = material.unidadeBase?.toString().toUpperCase();
      if (unit === 'M2' && variableValues['AREA_TOTAL'] !== undefined) {
        qtdEfetiva = Number(variableValues['AREA_TOTAL']) || 0;
        isDynamic = true;
      } else if ((unit === 'M' || unit === 'CM' || unit === 'MM') && variableValues['COMPRIMENTO_TOTAL'] !== undefined) {
        qtdEfetiva = Number(variableValues['COMPRIMENTO_TOTAL']) || 0;
        isDynamic = true;
      }
    }

    // ② Monta a string da fórmula:
    //    "(quantidade * custo_unitario)"
    const formulaStr = `(${qtdEfetiva} * ${material.precoBase})`;

    try {
      // ② Avalia a fórmula com mathjs (sem eval() nativo—seguro)
      const resultado = math.evaluate(formulaStr);

      // ③ Converte BigNumber → number JS para uso na UI
      const subtotal = Number(resultado);

      if (isNaN(subtotal)) {
        throw new Error(`Resultado não numérico para "${material.nome}"`);
      }

      // ④ Acumula no total geral
      totalAcumulado += subtotal;

      // ⑤ Adiciona ao detalhamento (exibido no tooltip)
      detalhamento.push({
        insumoId: material.insumoId,
        nome: material.nome,
        quantidade: qtdEfetiva,
        precoBase: material.precoBase,
        unidadeBase: material.unidadeBase,
        subtotal,
        // A string usada no mathjs (útil para debug e tooltip de fórmula)
        formula: `${isDynamic ? `[${material.linkedQuantityVariable}=${qtdEfetiva}]` : qtdEfetiva} × R$${material.precoBase.toFixed(4)} = R$${subtotal.toFixed(4)}  # ${material.nome}`,
      });
    } catch (err) {
      // Material com erro não bloqueia o cálculo dos demais
      const msg = `Erro ao calcular "${material.nome}": ${err instanceof Error ? err.message : String(err)}`;
      erros.push(msg);

      // Adiciona ao detalhamento com subtotal 0 para não sumir da lista
      detalhamento.push({
        insumoId: material.insumoId,
        nome: material.nome,
        quantidade: material.quantidadeUtilizada,
        precoBase: material.precoBase,
        unidadeBase: material.unidadeBase,
        subtotal: 0,
        formula: `ERRO: ${msg}`,
      });
    }
  });

  return {
    total: totalAcumulado,
    detalhamento,
    hasError: erros.length > 0,
    erros,
  };
}

/**
 * Formata o resultado para exibição em tooltip.
 * Retorna uma string multi-linha com detalhamento de cada insumo.
 *
 * @example
 * "• Filamento PLA — 0,5 KG × R$ 89,90 = R$ 44,95\n• Chapa MDF — 2 M2 × R$ 45,00 = R$ 90,00\n─────\nTotal: R$ 134,95"
 */
export function formatarDetalheTooltip(resultado: ResultadoCustoInsumos): string {
  if (resultado.detalhamento.length === 0) return 'Nenhum insumo adicionado.';

  const linhas = resultado.detalhamento.map((d) => {
    const qtd = d.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
    const preco = d.precoBase.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const sub = d.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    return `• ${d.nome} — ${qtd} ${d.unidadeBase} × ${preco} = ${sub}`;
  });

  const total = resultado.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return [...linhas, '─────────────────', `Total de Insumos: ${total}`].join('\n');
}
