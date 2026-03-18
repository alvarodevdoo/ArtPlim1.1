/**
 * Página: Insumos
 *
 * Gerencia o cadastro de matérias-primas (Insumos) usadas
 * no motor de cálculo de orçamentos dinâmicos.
 *
 * Integra: useInsumos (hook) + InsumoForm + tabela de listagem
 */

import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useInsumos } from '../features/insumos/useInsumos';
import { InsumoForm } from '../features/insumos/InsumoForm';
import { Insumo, InsumoFormData, UNIDADE_BASE_LABELS } from '../features/insumos/types';

export default function InsumosPage() {
  const { insumos, categorias, loading, error, criar, atualizar, toggleStatus, remover } =
    useInsumos();

  // ── Estado do modal de formulário ──────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [insumoEditando, setInsumoEditando] = useState<Insumo | null>(null);
  const [salvando, setSalvando] = useState(false);

  // ── Filtros da tabela ──────────────────────────────────────────────────────
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | 'ativos' | 'inativos'>('ativos');
  const [busca, setBusca] = useState('');

  // ── Insumos filtrados ──────────────────────────────────────────────────────
  const insumosFiltrados = useMemo(() => {
    return insumos.filter((ins) => {
      if (filtroAtivo === 'ativos' && !ins.ativo) return false;
      if (filtroAtivo === 'inativos' && ins.ativo) return false;
      if (filtroCategoria && ins.categoria !== filtroCategoria) return false;
      if (busca && !ins.nome.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [insumos, filtroAtivo, filtroCategoria, busca]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleNovoInsumo() {
    setInsumoEditando(null);
    setShowForm(true);
  }

  function handleEditar(insumo: Insumo) {
    setInsumoEditando(insumo);
    setShowForm(true);
  }

  async function handleSalvar(data: InsumoFormData) {
    setSalvando(true);
    try {
      if (insumoEditando) {
        await atualizar(insumoEditando.id, data);
        toast.success('Insumo atualizado com sucesso!');
      } else {
        await criar(data);
        toast.success('Insumo cadastrado com sucesso!');
      }
      setShowForm(false);
      setInsumoEditando(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar insumo');
    } finally {
      setSalvando(false);
    }
  }

  async function handleToggleStatus(insumo: Insumo) {
    try {
      await toggleStatus(insumo.id);
      toast.success(`Insumo ${insumo.ativo ? 'desativado' : 'ativado'} com sucesso.`);
    } catch {
      toast.error('Erro ao alterar status do insumo.');
    }
  }

  async function handleRemover(insumo: Insumo) {
    if (!confirm(`Remover permanentemente "${insumo.nome}"? Esta ação não pode ser desfeita.`))
      return;
    try {
      await remover(insumo.id);
      toast.success('Insumo removido.');
    } catch {
      toast.error('Erro ao remover insumo.');
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={styles.page}>
      {/* ── Cabeçalho ── */}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>🧪 Insumos</h1>
          <p style={styles.pageSubtitle}>
            Matérias-primas usadas no motor de cálculo de orçamentos dinâmicos
          </p>
        </div>
        <button onClick={handleNovoInsumo} style={styles.btnPrimary}>
          + Novo Insumo
        </button>
      </div>

      {/* ── Modal de Formulário ── */}
      {showForm && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <InsumoForm
              insumoInicial={insumoEditando}
              categoriasExistentes={categorias}
              onSave={handleSalvar}
              onCancel={() => { setShowForm(false); setInsumoEditando(null); }}
              loading={salvando}
            />
          </div>
        </div>
      )}

      {/* ── Filtros ── */}
      <div style={styles.filtros}>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="🔍 Buscar por nome..."
          style={styles.inputBusca}
        />

        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          style={styles.selectFiltro}
        >
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <div style={styles.tabGroup}>
          {(['ativos', 'inativos', 'todos'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setFiltroAtivo(opt)}
              style={{
                ...styles.tab,
                ...(filtroAtivo === opt ? styles.tabActive : {}),
              }}
            >
              {opt === 'ativos' ? '✅ Ativos' : opt === 'inativos' ? '⏸ Inativos' : '📋 Todos'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Estados de feedback ── */}
      {loading && (
        <div style={styles.feedback}>Carregando insumos...</div>
      )}
      {error && (
        <div style={{ ...styles.feedback, color: '#f38ba8', borderColor: '#f38ba8' }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Tabela ── */}
      {!loading && (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={styles.th}>Nome</th>
                <th style={styles.th}>Categoria</th>
                <th style={styles.th}>Unidade Base</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Custo / Unidade</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>Status</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {insumosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} style={styles.emptyRow}>
                    {busca || filtroCategoria
                      ? 'Nenhum insumo encontrado com esses filtros.'
                      : 'Nenhum insumo cadastrado ainda. Clique em "+ Novo Insumo" para começar.'}
                  </td>
                </tr>
              ) : (
                insumosFiltrados.map((ins) => (
                  <tr key={ins.id} style={{ ...styles.tr, opacity: ins.ativo ? 1 : 0.6 }}>
                    <td style={styles.td}>
                      <span style={{ fontWeight: 500, color: '#0f172a' }}>{ins.nome}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.badge}>{ins.categoria}</span>
                    </td>
                    <td style={styles.td}>
                      {UNIDADE_BASE_LABELS[ins.unidadeBase]}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 'bold', color: '#059669' }}>
                      {Number(ins.custoUnitario).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                        minimumFractionDigits: 4,
                      })}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <button
                        onClick={() => handleToggleStatus(ins)}
                        title={ins.ativo ? 'Desativar insumo' : 'Ativar insumo'}
                        style={{
                          ...styles.statusBtn,
                          background: ins.ativo ? '#dcfce7' : '#f1f5f9',
                          color: ins.ativo ? '#166534' : '#64748b',
                        }}
                      >
                        {ins.ativo ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button
                          onClick={() => handleEditar(ins)}
                          style={styles.btnIconEdit}
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleRemover(ins)}
                          style={styles.btnIconDel}
                          title="Remover permanentemente"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {insumosFiltrados.length > 0 && (
            <p style={styles.countMsg}>
              {insumosFiltrados.length} insumo{insumosFiltrados.length !== 1 ? 's' : ''} exibido{insumosFiltrados.length !== 1 ? 's' : ''}
              {insumos.length !== insumosFiltrados.length && ` de ${insumos.length} no total`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    padding: '24px',
    minHeight: '100%',
  },
  pageHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  pageTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
    color: '#0f172a',
  },
  pageSubtitle: {
    margin: '4px 0 0',
    fontSize: 13,
    color: '#64748b',
  },
  btnPrimary: {
    padding: '10px 20px',
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    maxWidth: 560,
    width: '100%',
    margin: '0 16px',
  },
  filtros: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap' as const,
  },
  inputBusca: {
    flex: 1,
    minWidth: 200,
    padding: '8px 12px',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    color: '#0f172a',
    fontSize: 14,
  },
  selectFiltro: {
    padding: '8px 12px',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    color: '#0f172a',
    fontSize: 13,
  },
  tabGroup: {
    display: 'flex',
    background: '#f1f5f9',
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
  },
  tab: {
    padding: '7px 14px',
    background: 'transparent',
    border: 'none',
    color: '#64748b',
    fontSize: 13,
    cursor: 'pointer',
  },
  tabActive: {
    background: '#ffffff',
    color: '#2563eb',
    fontWeight: 600,
  },
  feedback: {
    padding: '12px 16px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    color: '#475569',
    fontSize: 14,
    textAlign: 'center' as const,
  },
  tableWrapper: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  thead: {
    background: '#f8fafc',
  },
  th: {
    padding: '10px 16px',
    textAlign: 'left' as const,
    fontSize: 11,
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    borderBottom: '1px solid #e2e8f0',
  },
  tr: {
    borderBottom: '1px solid #f1f5f9',
    transition: 'background 0.15s',
  },
  td: {
    padding: '12px 16px',
    fontSize: 14,
    color: '#475569',
    verticalAlign: 'middle' as const,
  },
  emptyRow: {
    padding: '32px 16px',
    textAlign: 'center' as const,
    color: '#94a3b8',
    fontSize: 14,
  },
  badge: {
    display: 'inline-block',
    padding: '2px 10px',
    background: '#eff6ff',
    borderRadius: 20,
    fontSize: 12,
    color: '#2563eb',
  },
  statusBtn: {
    padding: '3px 12px',
    border: 'none',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnIconEdit: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: 14,
  },
  btnIconDel: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: 14,
  },
  countMsg: {
    padding: '8px 16px',
    fontSize: 12,
    color: '#94a3b8',
    margin: 0,
    borderTop: '1px solid #f1f5f9',
  },
};
