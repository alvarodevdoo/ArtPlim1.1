/**
 * SeletorInsumos – Componente para adicionar insumos a um orçamento
 *
 * Simula o comportamento de "Adicionar Material" na tela de Orçamento.
 * Mantém internamente um array de `InsumoMaterialSelecionado` via useState
 * e chama `onMaterialsChange` sempre que a lista muda.
 *
 * Este componente é usado dentro da tela de CriarOrcamento  para
 * compor o custo de materiais de uma peça. O array resultante é
 * passado para `calcularCustoInsumos()` que usa mathjs para calcular o total.
 *
 * Props:
 *   insumos           – lista de insumos disponíveis (do useInsumos)
 *   onMaterialsChange – callback chamado com a lista atualizada
 *   materiaisIniciais – opcional, para modo de edição
 *   somenteLeitura    – opcional, desabilita interações
 */

import React, { useState, useMemo } from 'react';
import {
  Insumo,
  InsumoMaterialSelecionado,
  UNIDADE_BASE_LABELS,
} from './types';
import { calcularCustoInsumos, formatarDetalheTooltip } from './calcularCustoInsumos';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SeletorInsumosProps {
  insumos: Insumo[];
  onMaterialsChange: (materiais: InsumoMaterialSelecionado[]) => void;
  materiaisIniciais?: InsumoMaterialSelecionado[];
  somenteLeitura?: boolean;
  availableVariables?: string[];
  variableValues?: Record<string, any>;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function SeletorInsumos({
  insumos,
  onMaterialsChange,
  materiaisIniciais = [],
  somenteLeitura = false,
  availableVariables = [],
  variableValues = {},
}: SeletorInsumosProps) {
  // ── Estado principal: array de materiais adicionados à peça ────────────────
  // Este é o array que alimenta o motor de cálculo (calcularCustoInsumos).
  // Cada item contém: { insumoId, nome, precoBase, quantidadeUtilizada, unidadeBase }
  const [materiaisAdicionados, setMateriaisAdicionados] = useState<InsumoMaterialSelecionado[]>(
    materiaisIniciais,
  );

  // Sincroniza se o pai carregar os dados de forma assíncrona
  React.useEffect(() => {
    // Só sincroniza se materiaisIniciais tiver dados e for diferente do estado atual
    // (compara comprimento apenas para simplicidade, ou poderia ser JSON.stringify)
    if (materiaisIniciais && materiaisIniciais.length > 0 && materiaisIniciais.length !== materiaisAdicionados.length) {
      setMateriaisAdicionados(materiaisIniciais);
    }
  }, [materiaisIniciais]);

  // ── Estado local do "formulário de adição" ─────────────────────────────────
  const [insumoSelecionadoId, setInsumoSelecionadoId] = useState<string>('');
  const [quantidade, setQuantidade] = useState<string>('1');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('');

  // Insumos ativos filtrados por categoria (se filtro aplicado)
  const insumosAtivos = useMemo(
    () => insumos.filter((i) => i.ativo && (!filtroCategoria || i.categoria === filtroCategoria)),
    [insumos, filtroCategoria],
  );

  // Categorias distintas dos insumos disponíveis
  const categorias = useMemo(
    () => Array.from(new Set(insumos.filter((i) => i.ativo).map((i) => i.categoria))).sort(),
    [insumos],
  );

  // Cálculo em tempo real usando mathjs
  const resultado = useMemo(
    () => calcularCustoInsumos(materiaisAdicionados, variableValues),
    [materiaisAdicionados, variableValues],
  );

  // Insumo selecionado no <select>
  const insumoAtual = insumos.find((i) => i.id === insumoSelecionadoId);

  // ── Atualizar lista e notificar pai ────────────────────────────────────────
  function setMateriais(lista: InsumoMaterialSelecionado[]) {
    setMateriaisAdicionados(lista);
    onMaterialsChange(lista);
  }

  // ── Adicionar insumo à lista ───────────────────────────────────────────────
  function handleAdicionar() {
    if (!insumoAtual) return;

    const qtd = parseFloat(quantidade.replace(',', '.'));
    if (isNaN(qtd) || qtd <= 0) return;

    // Verifica se já está na lista → acumula quantidade
    const existente = materiaisAdicionados.findIndex((m) => m.insumoId === insumoAtual.id);

    if (existente >= 0) {
      // Acumula a quantidade ao já existente
      const nova = [...materiaisAdicionados];
      nova[existente] = {
        ...nova[existente],
        quantidadeUtilizada: nova[existente].quantidadeUtilizada + qtd,
      };
      setMateriais(nova);
    } else {
      // Adiciona novo item ao array
      const novoItem: InsumoMaterialSelecionado = {
        insumoId: insumoAtual.id,
        nome: insumoAtual.nome,
        precoBase: Number(insumoAtual.custoUnitario),
        quantidadeUtilizada: qtd,
        unidadeBase: insumoAtual.unidadeBase,
      };
      setMateriais([...materiaisAdicionados, novoItem]);
    }

    // Reseta campos de adição
    setInsumoSelecionadoId('');
    setQuantidade('1');
  }

  // ── Alterar quantidade de um item já adicionado ───────────────────────────
  function handleAlterarQuantidade(insumoId: string, novaQtd: string) {
    const qtd = parseFloat(novaQtd.replace(',', '.'));
    if (isNaN(qtd) || qtd <= 0) return;

    setMateriais(
      materiaisAdicionados.map((m) =>
        m.insumoId === insumoId ? { ...m, quantidadeUtilizada: qtd } : m,
      ),
    );
  }

  // ── Alterar vínculo de variável de um item já adicionado ─────────────────
  function handleAlterarViculoVariable(insumoId: string, variable: string) {
    setMateriais(
      materiaisAdicionados.map((m) =>
        m.insumoId === insumoId ? { ...m, linkedVariable: variable || undefined } : m,
      ),
    );
  }

  function handleAlterarViculoQuantidadeVariable(insumoId: string, variable: string) {
    setMateriais(
      materiaisAdicionados.map((m) =>
        m.insumoId === insumoId ? { ...m, linkedQuantityVariable: variable || undefined } : m,
      ),
    );
  }

  // ── Remover item da lista ──────────────────────────────────────────────────
  function handleRemover(insumoId: string) {
    setMateriais(materiaisAdicionados.filter((m) => m.insumoId !== insumoId));
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h4 style={styles.title}>🧪 Insumos / Materiais</h4>

        {/* Total com tooltip de detalhamento – usa atributo `title` nativo do HTML */}
        <div
          style={styles.totalBadge}
          title={formatarDetalheTooltip(resultado)}
        >
          <span style={styles.totalLabel}>Custo Total</span>
          <span style={styles.totalValue}>
            {resultado.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
          {resultado.hasError && <span style={styles.errorBadge}>⚠</span>}
        </div>
      </div>

      {/* Painel de adição de insumos */}
      {!somenteLeitura && (
        <div style={styles.addPanel}>
          {/* Filtro de categoria */}
          <select
            value={filtroCategoria}
            onChange={(e) => { setFiltroCategoria(e.target.value); setInsumoSelecionadoId(''); }}
            style={{ ...styles.select, maxWidth: 160 }}
          >
            <option value="">Todas as categorias</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Seletor de insumo */}
          <select
            value={insumoSelecionadoId}
            onChange={(e) => setInsumoSelecionadoId(e.target.value)}
            style={styles.select}
          >
            <option value="">— Selecione o insumo —</option>
            {insumosAtivos.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nome} ({UNIDADE_BASE_LABELS[i.unidadeBase]}) —{' '}
                {Number(i.custoUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </option>
            ))}
          </select>

          {/* Quantidade */}
          <input
            type="number"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            step="0.001"
            min="0.001"
            placeholder="Qtd"
            style={{ ...styles.select, maxWidth: 90, textAlign: 'right' }}
          />
          {insumoAtual && (
            <span style={styles.unidadeLabel}>{insumoAtual.unidadeBase}</span>
          )}

          <button
            type="button"
            onClick={handleAdicionar}
            disabled={!insumoSelecionadoId}
            style={styles.btnAdd}
          >
            + Adicionar
          </button>
        </div>
      )}

      {/* Lista de materiais adicionados */}
      {materiaisAdicionados.length === 0 ? (
        <p style={styles.emptyMsg}>Nenhum insumo adicionado ainda.</p>
      ) : (
        <div style={styles.lista}>
          {/* Cabeçalho */}
          <div style={{ ...styles.listaRow, ...styles.listaHeader }}>
            <span style={{ flex: 3 }}>Insumo</span>
            {availableVariables.length > 0 && <span style={{ flex: 1.5 }}>Vínculo Fórmula</span>}
            <span style={{ flex: 1.5, textAlign: 'right' }}>Qtd / Área</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Preço Base</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Subtotal</span>
            {!somenteLeitura && <span style={{ width: 36 }} />}
          </div>

          {/* Linhas dos materiais */}
          {materiaisAdicionados.map((m) => {
            const subtotal = m.quantidadeUtilizada * m.precoBase;
            return (
              <div key={m.insumoId} style={styles.listaRow}>
                <span style={{ flex: 3, fontWeight: 500, color: '#0f172a' }}>{m.nome}</span>

                {/* Seletor de Variável da Fórmula (Preço) */}
                {availableVariables.length > 0 && (
                  <div style={{ flex: 1.5 }}>
                    <select
                      value={m.linkedVariable || ''}
                      onChange={(e) => handleAlterarViculoVariable(m.insumoId, e.target.value)}
                      style={{ ...styles.select, padding: '4px 6px', fontSize: 11, height: 26 }}
                      disabled={somenteLeitura}
                    >
                      <option value="">— Sem Vínculo —</option>
                      {availableVariables.map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Quantidade editável com indicadores automáticos */}
                <div style={{ flex: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  {(() => {
                    const unit = m.unidadeBase?.toUpperCase();
                    const isAuto = !m.linkedQuantityVariable && (
                      (unit === 'M2' && variableValues['AREA_TOTAL'] !== undefined) ||
                      ((unit === 'M' || unit === 'CM' || unit === 'MM') && variableValues['COMPRIMENTO_TOTAL'] !== undefined)
                    );

                    const displayValue = isAuto 
                      ? (unit === 'M2' ? variableValues['AREA_TOTAL'] : variableValues['COMPRIMENTO_TOTAL'])
                      : m.quantidadeUtilizada;

                    return (
                      <>
                        {isAuto && (
                          <span 
                            title="Calculado automaticamente" 
                            style={{ fontSize: 9, color: '#059669', fontWeight: 'bold', background: '#ecfdf5', padding: '2px 4px', borderRadius: 4 }}
                          >
                            AUTO
                          </span>
                        )}
                        {m.linkedQuantityVariable && (
                          <span 
                            title={`Vinculado a: ${m.linkedQuantityVariable}`}
                            style={{ fontSize: 9, color: '#2563eb', fontWeight: 'bold', background: '#eff6ff', padding: '2px 4px', borderRadius: 4 }}
                          >
                            🔗 {m.linkedQuantityVariable}
                          </span>
                        )}
                        <input
                          type="number"
                          step="0.001"
                          value={isAuto ? Number(displayValue).toFixed(3) : (m.quantidadeUtilizada || 0)}
                          onChange={(e) => handleAlterarQuantidade(m.insumoId, e.target.value)}
                          style={{
                            ...styles.qtdInput,
                            width: 60,
                            height: 24,
                            textAlign: 'right',
                            fontSize: 12,
                            backgroundColor: (isAuto || m.linkedQuantityVariable) ? '#f8fafc' : '#fff',
                            color: (isAuto || m.linkedQuantityVariable) ? '#64748b' : '#000',
                            border: '1px solid #e2e8f0',
                            padding: '0 4px',
                            cursor: (isAuto || m.linkedQuantityVariable) ? 'not-allowed' : 'text'
                          }}
                          disabled={somenteLeitura || isAuto || !!m.linkedQuantityVariable}
                        />
                        
                        {/* Botão discreto para vincular quantidade manualmente (ex: Ilhós) */}
                        {!somenteLeitura && !isAuto && !m.linkedQuantityVariable && (
                          <div className="group relative">
                            <select
                              value=""
                              onChange={(e) => handleAlterarViculoQuantidadeVariable(m.insumoId, e.target.value)}
                              style={{ width: 14, height: 14, opacity: 0.3, cursor: 'pointer', border: 'none', background: 'transparent' }}
                              title="Vincular quantidade à variável"
                            >
                              <option value="">🔗</option>
                              {availableVariables.map(v => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Botão para romper vínculo */}
                        {!somenteLeitura && (m.linkedQuantityVariable) && (
                          <button
                            type="button"
                            onClick={() => handleAlterarViculoQuantidadeVariable(m.insumoId, '')}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#ef4444', fontSize: 10 }}
                            title="Voltar para manual"
                          >
                            ✕
                          </button>
                        )}
                      </>
                    );
                  })()}
                  <span style={styles.unidadeLabel}>{m.unidadeBase}</span>
                </div>

                <span style={{ ...styles.cell, flex: 1, textAlign: 'right' }}>
                  {m.precoBase.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>

                <span style={{ ...styles.cell, flex: 1, textAlign: 'right', color: '#059669', fontWeight: 600 }}>
                  {subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>

                {!somenteLeitura && (
                  <button
                    type="button"
                    onClick={() => handleRemover(m.insumoId)}
                    style={styles.btnRemove}
                    title="Remover"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}

          {/* Linha de total */}
          <div style={{ ...styles.listaRow, borderTop: '1px solid #e2e8f0', marginTop: 4, paddingTop: 8 }}>
            <span style={{ flex: availableVariables.length > 0 ? 7 : 5, textAlign: 'right', color: '#64748b', fontSize: 12 }}>Total de Insumos:</span>
            <span style={{ flex: 1, textAlign: 'right' , color: '#059669', fontWeight: 700, fontSize: 15 }}>
              {resultado.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
            {!somenteLeitura && <span style={{ width: 36 }} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: '#0f172a',
  },
  totalBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#f1f5f9',
    borderRadius: 8,
    padding: '6px 14px',
    cursor: 'default',
  },
  totalLabel: { fontSize: 12, color: '#64748b' },
  totalValue: { fontSize: 16, fontWeight: 700, color: '#059669' },
  errorBadge: { color: '#f97316', fontSize: 14 },
  addPanel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  select: {
    padding: '7px 10px',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    color: '#0f172a',
    fontSize: 13,
    flex: 1,
    minWidth: 0,
  },
  btnAdd: {
    padding: '7px 16px',
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  emptyMsg: {
    textAlign: 'center' as const,
    color: '#6c7086',
    fontSize: 13,
    padding: '8px 0',
    margin: 0,
  },
  lista: { display: 'flex', flexDirection: 'column', gap: 6 },
  listaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 13,
    color: '#475569',
  },
  listaHeader: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    paddingBottom: 4,
    borderBottom: '1px solid #e2e8f0',
  },
  cell: { color: '#475569' },
  qtdInput: {
    width: 70,
    padding: '4px 6px',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    color: '#0f172a',
    fontSize: 13,
    textAlign: 'right' as const,
  },
  unidadeLabel: {
    fontSize: 11,
    color: '#6c7086',
    minWidth: 24,
  },
  btnRemove: {
    width: 28,
    height: 28,
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    color: '#ef4444',
    cursor: 'pointer',
    fontSize: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
};
