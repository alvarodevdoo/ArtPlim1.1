/**
 * InsumoForm – Formulário de Cadastro/Edição de Insumos
 *
 * Componente controlado com React Hooks (useState).
 * Suporta dois modos: criação (sem `insumoInicial`) e edição (com `insumoInicial`).
 *
 * Props:
 *   insumoInicial  – opcional, preenche o form para edição
 *   onSave         – callback chamado com os dados validados
 *   onCancel       – callback para fechar modal/cancelar
 *   loading        – desabilita botões durante submit
 */

import React, { useState, useEffect } from 'react';
import {
  Insumo,
  InsumoFormData,
  UnidadeBase,
  UNIDADE_BASE_LABELS,
  CATEGORIAS_INSUMO,
} from './types';
import api from '@/lib/api';
import { Trash2, Star, Plus } from 'lucide-react';

// ─── Props ────────────────────────────────────────────────────────────────────

interface InsumoFormProps {
  insumoInicial?: Insumo | null;
  categoriasExistentes?: string[];   // categorias já cadastradas para autocomplete
  onSave: (data: InsumoFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

// ─── Estado inicial do formulário ─────────────────────────────────────────────

const FORM_VAZIO: InsumoFormData = {
  nome: '',
  categoria: '',
  unidadeBase: 'UN',
  custoUnitario: 0,
  ativo: true,
};

// ─── Componente ───────────────────────────────────────────────────────────────

export function InsumoForm({
  insumoInicial,
  categoriasExistentes = [],
  onSave,
  onCancel,
  loading = false,
}: InsumoFormProps) {
  // Inicializa com o insumo existente se estiver em modo edição
  const [form, setForm] = useState<InsumoFormData>(
    insumoInicial
      ? {
          nome: insumoInicial.nome,
          categoria: insumoInicial.categoria,
          unidadeBase: insumoInicial.unidadeBase,
          custoUnitario: Number(insumoInicial.custoUnitario),
          ativo: insumoInicial.ativo,
        }
      : FORM_VAZIO,
  );

  const [fornecedoresVinculados, setFornecedoresVinculados] = useState<any[]>([]);
  const [fornecedoresDisponiveis, setFornecedoresDisponiveis] = useState<any[]>([]);
  const [fornecedorSelecionadoId, setFornecedorSelecionadoId] = useState('');
  
  const [errors, setErrors] = useState<Partial<Record<keyof InsumoFormData, string>>>({});
  const [categoriaCustom, setCategoriaCustom] = useState(false);

  // Detecta se a categoria do insumo não está na lista predefinida (modo custom)
  useEffect(() => {
    if (insumoInicial) {
      const naLista = (CATEGORIAS_INSUMO as readonly string[]).includes(insumoInicial.categoria);
      setCategoriaCustom(!naLista);
      loadFornecedoresVinculados();
    }
    loadFornecedoresDisponiveis();
  }, [insumoInicial]);

  const loadFornecedoresDisponiveis = async () => {
    try {
      const resp = await api.get('/api/profiles?isSupplier=true');
      setFornecedoresDisponiveis(resp.data.data);
    } catch (err) {
      console.error('Erro ao carregar fornecedores disponiveis', err);
    }
  };

  const loadFornecedoresVinculados = async () => {
    if (!insumoInicial) return;
    try {
      const resp = await api.get(`/api/insumos/${insumoInicial.id}/fornecedores`);
      setFornecedoresVinculados(resp.data.data);
    } catch (err) {
      console.error('Erro ao carregar fornecedores vinculados', err);
    }
  };

  const handleAddFornecedor = async () => {
    if (!fornecedorSelecionadoId || !insumoInicial) return;
    
    try {
      await api.post(`/api/insumos/${insumoInicial.id}/fornecedores`, {
        fornecedorId: fornecedorSelecionadoId,
        ativo: fornecedoresVinculados.length === 0 // primeiro é ativo por padrão
      });
      setFornecedorSelecionadoId('');
      loadFornecedoresVinculados();
    } catch (err) {
      console.error('Erro ao vincular fornecedor', err);
    }
  };

  const handleSetAtivo = async (relationId: string) => {
    if (!insumoInicial) return;
    try {
      await api.patch(`/api/insumos/${insumoInicial.id}/fornecedores/${relationId}/ativo`);
      loadFornecedoresVinculados();
    } catch (err) {
      console.error('Erro ao definir fornecedor ativo', err);
    }
  };

  const handleRemoveFornecedor = async (relationId: string) => {
    if (!insumoInicial || !confirm('Remover este fornecedor?')) return;
    try {
      await api.delete(`/api/insumos/${insumoInicial.id}/fornecedores/${relationId}`);
      loadFornecedoresVinculados();
    } catch (err) {
      console.error('Erro ao remover fornecedor', err);
    }
  };

  // ── Handlers de mudança ─────────────────────────────────────────────────────

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : name === 'custoUnitario'
          ? parseFloat(value.replace(',', '.')) || 0
          : value,
    }));
    // Limpa erro do campo editado
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  // ── Validação local ─────────────────────────────────────────────────────────

  function validate(): boolean {
    const newErrors: Partial<Record<keyof InsumoFormData, string>> = {};

    if (!form.nome.trim() || form.nome.length < 2) {
      newErrors.nome = 'Nome deve ter pelo menos 2 caracteres.';
    }
    if (!form.categoria.trim()) {
      newErrors.categoria = 'Categoria é obrigatória.';
    }
    if (!form.unidadeBase) {
      newErrors.unidadeBase = 'Selecione uma unidade base.';
    }
    if (!form.custoUnitario || form.custoUnitario <= 0) {
      newErrors.custoUnitario = 'Custo unitário deve ser maior que zero.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    await onSave(form);
  }

  // Categorias disponíveis: predefinidas + as já cadastradas no servidor
  const todasCategorias = Array.from(
    new Set([...CATEGORIAS_INSUMO, ...categoriasExistentes]),
  ).sort();

  const isEditing = !!insumoInicial;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h3 style={styles.title}>{isEditing ? '✏️ Editar Insumo' : '➕ Novo Insumo'}</h3>

      {/* Nome */}
      <div style={styles.field}>
        <label style={styles.label}>Nome *</label>
        <input
          name="nome"
          value={form.nome}
          onChange={handleChange}
          placeholder="Ex: Filamento PLA Branco, Chapa MDF 3mm"
          disabled={loading}
          style={{ ...styles.input, ...(errors.nome ? styles.inputError : {}) }}
        />
        {errors.nome && <span style={styles.errorMsg}>{errors.nome}</span>}
      </div>

      {/* Categoria */}
      <div style={styles.field}>
        <label style={styles.label}>Categoria *</label>
        {!categoriaCustom ? (
          <select
            name="categoria"
            value={form.categoria}
            onChange={(e) => {
              if (e.target.value === '__custom__') {
                setCategoriaCustom(true);
                setForm((p) => ({ ...p, categoria: '' }));
              } else {
                handleChange(e);
              }
            }}
            disabled={loading}
            style={{ ...styles.input, ...(errors.categoria ? styles.inputError : {}) }}
          >
            <option value="">— Selecione —</option>
            {todasCategorias.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
            <option value="__custom__">+ Digitar outra categoria...</option>
          </select>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              name="categoria"
              value={form.categoria}
              onChange={handleChange}
              placeholder="Digite a categoria"
              disabled={loading}
              style={{ ...styles.input, flex: 1, ...(errors.categoria ? styles.inputError : {}) }}
            />
            <button
              type="button"
              onClick={() => { setCategoriaCustom(false); setForm((p) => ({ ...p, categoria: '' })); }}
              style={styles.btnSecondary}
            >
              Lista
            </button>
          </div>
        )}
        {errors.categoria && <span style={styles.errorMsg}>{errors.categoria}</span>}
      </div>

      {/* Unidade Base + Custo por Unidade (lado a lado) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={styles.field}>
          <label style={styles.label}>Unidade Base *</label>
          <select
            name="unidadeBase"
            value={form.unidadeBase}
            onChange={handleChange}
            disabled={loading}
            style={{ ...styles.input, ...(errors.unidadeBase ? styles.inputError : {}) }}
          >
            {(Object.keys(UNIDADE_BASE_LABELS) as UnidadeBase[]).map((u) => (
              <option key={u} value={u}>{UNIDADE_BASE_LABELS[u]}</option>
            ))}
          </select>
          {errors.unidadeBase && <span style={styles.errorMsg}>{errors.unidadeBase}</span>}
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Custo por Unidade (R$) *</label>
          <input
            name="custoUnitario"
            type="number"
            step="0.0001"
            min="0.0001"
            value={form.custoUnitario || ''}
            onChange={handleChange}
            placeholder="0,0000"
            disabled={loading}
            style={{ ...styles.input, ...(errors.custoUnitario ? styles.inputError : {}) }}
          />
          {errors.custoUnitario && <span style={styles.errorMsg}>{errors.custoUnitario}</span>}
        </div>
      </div>

      {/* Status Ativo */}
      <div style={{ ...styles.field, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <input
          id="ativo-check"
          name="ativo"
          type="checkbox"
          checked={form.ativo}
          onChange={handleChange}
          disabled={loading}
          style={{ width: 18, height: 18, cursor: 'pointer' }}
        />
        <label htmlFor="ativo-check" style={{ ...styles.label, margin: 0, cursor: 'pointer' }}>
          Insumo ativo
        </label>
      </div>

      {/* Seção de Fornecedores (Somente em modo edição para simplificar fluxo) */}
      {isEditing && (
        <div style={{ ...styles.field, marginTop: 10, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
          <label style={{ ...styles.label, color: '#0f172a', fontWeight: 600 }}>Fornecedores</label>
          
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <select 
              value={fornecedorSelecionadoId}
              onChange={(e) => setFornecedorSelecionadoId(e.target.value)}
              style={{ ...styles.input, flex: 1 }}
            >
              <option value="">— Selecione um fornecedor —</option>
              {fornecedoresDisponiveis
                .filter(f => !fornecedoresVinculados.find(v => v.fornecedorId === f.id))
                .map(f => <option key={f.id} value={f.id}>{f.name}</option>)
              }
            </select>
            <button 
              type="button" 
              onClick={handleAddFornecedor}
              disabled={!fornecedorSelecionadoId}
              style={{ ...styles.btnPrimary, padding: '8px 12px' }}
            >
              <Plus size={18} />
            </button>
          </div>

          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fornecedoresVinculados.map(rel => (
              <div key={rel.id} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '8px 12px', 
                background: '#f8fafc', 
                borderRadius: 8,
                border: rel.ativo ? '1px solid #2563eb' : '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {rel.ativo ? <Star size={16} fill="#2563eb" color="#2563eb" /> : <Star size={16} color="#94a3b8" onClick={() => handleSetAtivo(rel.id)} style={{ cursor: 'pointer' }} />}
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{rel.fornecedor.name}</span>
                </div>
                <button type="button" onClick={() => handleRemoveFornecedor(rel.id)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {fornecedoresVinculados.length === 0 && (
              <p style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Nenhum fornecedor vinculado.</p>
            )}
          </div>
        </div>
      )}

      {/* Ações */}
      <div style={styles.actions}>
        <button type="button" onClick={onCancel} disabled={loading} style={styles.btnSecondary}>
          Cancelar
        </button>
        <button type="submit" disabled={loading} style={styles.btnPrimary}>
          {loading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Insumo'}
        </button>
      </div>
    </form>
  );
}

// ─── Estilos inline (sem dependência de CSS externo) ─────────────────────────

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: '20px 24px',
    background: '#ffffff',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    minWidth: 420,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: '#0f172a',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: '#64748b',
  },
  input: {
    padding: '8px 12px',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    color: '#0f172a',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorMsg: {
    fontSize: 12,
    color: '#ef4444',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  btnPrimary: {
    padding: '9px 20px',
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnSecondary: {
    padding: '9px 16px',
    background: '#ffffff',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    fontSize: 14,
    cursor: 'pointer',
  },
};
