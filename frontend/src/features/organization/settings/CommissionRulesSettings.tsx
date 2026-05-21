import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Plus, Trash2, Pencil, Check, X, Percent } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import api from '@/lib/api';

interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
}

interface CommissionRule {
  id: string;
  roleId: string;
  rate: number;
  description: string | null;
  categoryId: string | null;
  role?: Role;
  category?: Category | null;
}

interface EditState {
  rate: string;
  description: string;
  categoryId: string;
}

const selectClass =
  'flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

export const CommissionRulesSettings: React.FC = () => {
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [enableCommissions, setEnableCommissions] = useState(true);
  const [loading, setLoading] = useState(false);

  const [newRule, setNewRule] = useState({ roleId: '', rate: '', description: '', categoryId: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<EditState>({ rate: '', description: '', categoryId: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rulesRes, rolesRes, settingsRes, categoriesRes] = await Promise.all([
        api.get('/api/finance/commission-rules'),
        api.get('/api/organization/roles'),
        api.get('/api/organization/settings'),
        api.get('/api/finance/categories')
      ]);
      setRules(rulesRes.data.data);
      setRoles(rolesRes.data.data);
      setEnableCommissions(settingsRes.data.data.enableCommissions ?? true);
      const allCategories: Category[] = categoriesRes.data.data ?? [];
      setCategories(allCategories.filter(c => c.type === 'EXPENSE'));
    } catch {
      toast.error('Erro ao carregar matriz de comissões');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCommissions = async (checked: boolean) => {
    try {
      await api.put('/api/organization/settings', { enableCommissions: checked });
      setEnableCommissions(checked);
      toast.success(checked ? 'Sistema de comissões habilitado' : 'Sistema de comissões desabilitado');
    } catch {
      toast.error('Erro ao atualizar configuração');
    }
  };

  const handleAddRule = async () => {
    if (!newRule.roleId || !newRule.rate) {
      toast.error('Preencha o Papel e a Taxa (%)');
      return;
    }
    try {
      await api.post('/api/finance/commission-rules', {
        roleId: newRule.roleId,
        rate: Number(newRule.rate),
        description: newRule.description || undefined,
        categoryId: newRule.categoryId || undefined
      });
      toast.success('Regra adicionada com sucesso');
      setNewRule({ roleId: '', rate: '', description: '', categoryId: '' });
      fetchData();
    } catch {
      toast.error('Erro ao adicionar regra de comissão');
    }
  };

  const handleEditStart = (rule: CommissionRule) => {
    setEditingId(rule.id);
    setEditData({
      rate: String(rule.rate),
      description: rule.description ?? '',
      categoryId: rule.categoryId ?? ''
    });
  };

  const handleEditCancel = () => {
    setEditingId(null);
  };

  const handleEditSave = async (id: string) => {
    if (!editData.rate) {
      toast.error('A taxa não pode ser vazia');
      return;
    }
    try {
      await api.patch(`/api/finance/commission-rules/${id}`, {
        rate: Number(editData.rate),
        description: editData.description || undefined,
        categoryId: editData.categoryId || undefined
      });
      toast.success('Regra atualizada');
      setEditingId(null);
      fetchData();
    } catch {
      toast.error('Erro ao salvar alterações');
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await api.delete(`/api/finance/commission-rules/${id}`);
      toast.success('Regra removida');
      fetchData();
    } catch {
      toast.error('Erro ao remover regra');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Percent className="w-5 h-5 text-emerald-500" />
            Matriz de Distribuição de Comissões
          </CardTitle>
          <CardDescription>
            Defina as taxas de comissão automáticas para cada função da equipe envolvida na venda e produção.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-lg border border-slate-100">
          <Label htmlFor="enable-commissions" className="text-sm font-medium cursor-pointer">Habilitar Sistema</Label>
          <Switch
            id="enable-commissions"
            checked={enableCommissions}
            onCheckedChange={handleToggleCommissions}
          />
        </div>
      </CardHeader>

      <CardContent>
        {!enableCommissions ? (
          <div className="bg-amber-50 border border-amber-100 text-amber-800 p-3 rounded-lg text-sm flex items-center gap-2">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            O sistema de comissões está desativado globalmente. Ative-o acima para gerenciar as regras.
          </div>
        ) : (
          <>
        {/* Formulário de Nova Regra */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div className="col-span-1 md:col-span-3 space-y-2">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Papel / Função</Label>
            <select className={selectClass} value={newRule.roleId} onChange={e => setNewRule({ ...newRule, roleId: e.target.value })}>
              <option value="">Selecione um papel</option>
              {roles.map(role => (
                <option key={role.id} value={role.id}>
                  {role.name} {role.description ? `(${role.description})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-1 md:col-span-2 space-y-2">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Taxa (%)</Label>
            <Input type="number" min="0" step="0.01" placeholder="Ex: 5" value={newRule.rate} onChange={e => setNewRule({ ...newRule, rate: e.target.value })} />
          </div>

          <div className="col-span-1 md:col-span-3 space-y-2">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Categoria (Plano de Contas)</Label>
            <select className={selectClass} value={newRule.categoryId} onChange={e => setNewRule({ ...newRule, categoryId: e.target.value })}>
              <option value="">Sem categoria</option>
              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </div>

          <div className="col-span-1 md:col-span-2 space-y-2">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Descrição</Label>
            <Input type="text" placeholder="Opcional" value={newRule.description} onChange={e => setNewRule({ ...newRule, description: e.target.value })} />
          </div>

          <div className="col-span-1 md:col-span-2">
            <Button onClick={handleAddRule} className="w-full gap-2" disabled={loading}>
              <Plus className="w-4 h-4" />
              Adicionar
            </Button>
          </div>
        </div>

        {/* Lista de Regras */}
        <div className="space-y-3">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Regras Ativas</Label>

          {rules.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-xl text-slate-500 text-sm">
              <span className="font-bold text-slate-700">Nenhuma regra cadastrada.</span><br />
              Adicione um papel e uma taxa acima para começar.
            </div>
          ) : (
            <div className="border rounded-xl divide-y overflow-hidden">
              {rules.map(rule => {
                const isEditing = editingId === rule.id;
                return (
                  <div key={rule.id} className="p-4 hover:bg-slate-50 transition-colors">
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="text-sm font-semibold text-slate-700">{rule.role?.name || 'Desconhecido'}</div>
                        <div className="flex flex-wrap gap-3 items-end">
                          <div className="space-y-1 w-24">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Taxa (%)</Label>
                            <Input
                              type="number" min="0" step="0.01"
                              value={editData.rate}
                              onChange={e => setEditData({ ...editData, rate: e.target.value })}
                              autoFocus
                            />
                          </div>
                          <div className="space-y-1 flex-1 min-w-[160px]">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categoria</Label>
                            <select className={selectClass} value={editData.categoryId} onChange={e => setEditData({ ...editData, categoryId: e.target.value })}>
                              <option value="">Sem categoria</option>
                              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1 flex-1 min-w-[140px]">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descrição</Label>
                            <Input
                              type="text" placeholder="Opcional"
                              value={editData.description}
                              onChange={e => setEditData({ ...editData, description: e.target.value })}
                            />
                          </div>
                          <div className="flex gap-1 pb-0.5">
                            <Button size="icon" variant="ghost" className="text-emerald-600 hover:bg-emerald-50" onClick={() => handleEditSave(rule.id)}>
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="text-slate-400 hover:bg-slate-100" onClick={handleEditCancel}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-slate-900">{rule.role?.name || 'Desconhecido'}</div>
                          {rule.category && (
                            <div className="text-xs text-primary/80 mt-0.5">{rule.category.name}</div>
                          )}
                          {rule.description && (
                            <div className="text-xs text-slate-500 mt-0.5">{rule.description}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-sm">
                            {Number(rule.rate).toFixed(2)}%
                          </div>
                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-700 hover:bg-slate-100" onClick={() => handleEditStart(rule)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteRule(rule.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
