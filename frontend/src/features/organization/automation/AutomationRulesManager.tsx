import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { Plus, Pencil, Trash2, Zap, Loader2, X, AlertTriangle, Power, PowerOff, Braces, Copy, Check } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

type TriggerType = 'status_change' | 'time_based' | 'overdue' | 'manual';
type ActionType = 'whatsapp' | 'email' | 'notification' | 'status_update';

interface AutomationRule {
  id: string;
  name: string;
  description?: string | null;
  trigger: TriggerType;
  action: ActionType;
  conditions: Record<string, any>;
  enabled: boolean;
  lastRun?: string | null;
  runCount: number;
}

const TRIGGER_LABELS: Record<TriggerType, string> = {
  status_change: 'Mudança de status',
  time_based: 'Baseada em tempo',
  overdue: 'Vencido',
  manual: 'Manual',
};

const ACTION_LABELS: Record<ActionType, string> = {
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  notification: 'Notificação interna',
  status_update: 'Atualizar status',
};

interface Props {
  automationEnabled: boolean;
}

export const AutomationRulesManager: React.FC<Props> = ({ automationEnabled }) => {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AutomationRule | null>(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const resp = await api.get('/api/sales/automation/rules');
      if (resp.data.success) setRules(resp.data.data);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar regras');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (rule: AutomationRule) => {
    if (!automationEnabled) {
      toast.error('Automações estão desabilitadas nas configurações da organização');
      return;
    }
    try {
      const resp = await api.patch(`/api/sales/automation/rules/${rule.id}/toggle`);
      if (resp.data.success) {
        setRules(prev => prev.map(r => (r.id === rule.id ? resp.data.data : r)));
      }
    } catch {
      toast.error('Erro ao alternar regra');
    }
  };

  const handleDelete = async (rule: AutomationRule) => {
    if (!confirm(`Excluir a regra "${rule.name}"?`)) return;
    try {
      await api.delete(`/api/sales/automation/rules/${rule.id}`);
      setRules(prev => prev.filter(r => r.id !== rule.id));
      toast.success('Regra excluída');
    } catch {
      toast.error('Erro ao excluir regra');
    }
  };

  const openCreate = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (rule: AutomationRule) => {
    setEditing(rule);
    setShowModal(true);
  };

  const handleSubmit = async (data: Partial<AutomationRule>) => {
    try {
      setSaving(true);
      if (editing) {
        const resp = await api.put(`/api/sales/automation/rules/${editing.id}`, data);
        if (resp.data.success) {
          setRules(prev => prev.map(r => (r.id === editing.id ? resp.data.data : r)));
          toast.success('Regra atualizada');
        }
      } else {
        const resp = await api.post('/api/sales/automation/rules', data);
        if (resp.data.success) {
          setRules(prev => [resp.data.data, ...prev]);
          toast.success('Regra criada');
        }
      }
      setShowModal(false);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao salvar regra');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" /> Regras de Automação
            </CardTitle>
            <CardDescription>
              Crie regras para automatizar lembretes, follow-ups e notificações de pedidos.
            </CardDescription>
          </div>
          <Button onClick={openCreate} disabled={!automationEnabled}>
            <Plus className="w-4 h-4 mr-2" /> Nova Regra
          </Button>
        </div>
        {!automationEnabled && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <span className="text-sm text-yellow-800">
              Automações estão desabilitadas em <strong>Sistema → Módulos Ativos</strong>.
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            Nenhuma regra cadastrada. Clique em <strong>Nova Regra</strong> para criar.
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map(rule => (
              <div
                key={rule.id}
                className={`flex items-center justify-between gap-3 p-3 border rounded-lg ${
                  rule.enabled && automationEnabled ? 'border-green-200 bg-green-50/40' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-3 h-3 rounded-full ${rule.enabled && automationEnabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{rule.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {rule.description || '—'}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-1 text-[11px] text-muted-foreground">
                      <span>Trigger: <strong>{TRIGGER_LABELS[rule.trigger]}</strong></span>
                      <span>Ação: <strong>{ACTION_LABELS[rule.action]}</strong></span>
                      <span>Execuções: <strong>{rule.runCount}</strong></span>
                      {rule.lastRun && <span>Última: <strong>{formatDateTime(rule.lastRun)}</strong></span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggle(rule)}
                    disabled={!automationEnabled}
                    title={rule.enabled ? 'Desativar' : 'Ativar'}
                  >
                    {rule.enabled
                      ? <Power className="w-4 h-4 text-green-600" />
                      : <PowerOff className="w-4 h-4 text-gray-400" />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(rule)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(rule)}>
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {showModal && (
        <RuleFormModal
          rule={editing}
          saving={saving}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
        />
      )}
    </Card>
  );
};

interface RuleFormModalProps {
  rule: AutomationRule | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<AutomationRule>) => void;
}

const ORDER_STATUSES = [
  { value: 'DRAFT', label: 'Rascunho' },
  { value: 'PENDING', label: 'Aguardando aprovação' },
  { value: 'APPROVED', label: 'Aprovado' },
  { value: 'IN_PRODUCTION', label: 'Em produção' },
  { value: 'FINISHED', label: 'Finalizado' },
  { value: 'DELIVERED', label: 'Entregue' },
  { value: 'CANCELLED', label: 'Cancelado' },
];

const WEEKDAYS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

const RuleFormModal: React.FC<RuleFormModalProps> = ({ rule, saving, onClose, onSubmit }) => {
  const [name, setName] = useState(rule?.name || '');
  const [description, setDescription] = useState(rule?.description || '');
  const [trigger, setTrigger] = useState<TriggerType>(rule?.trigger || 'status_change');
  const [action, setAction] = useState<ActionType>(rule?.action || 'notification');
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);

  // Campos estruturados das condições
  const c = rule?.conditions || {};
  const [fromStatus, setFromStatus] = useState<string>(c.fromStatus || '');
  const [toStatus, setToStatus] = useState<string>(c.toStatus || '');
  const [statusCond, setStatusCond] = useState<string>(c.status || '');
  const [daysBeforeExpiry, setDaysBeforeExpiry] = useState<string>(c.daysBeforeExpiry?.toString() || '');
  const [daysAfterDelivery, setDaysAfterDelivery] = useState<string>(c.daysAfterDelivery?.toString() || '');
  const [daysInSameStatus, setDaysInSameStatus] = useState<string>(c.daysInSameStatus?.toString() || '');
  const [messageTemplate, setMessageTemplate] = useState<string>(c.messageTemplate || '');

  // Horário comercial
  const [respectBH, setRespectBH] = useState<boolean>(!!c.respectBusinessHours);
  const [bhStart, setBhStart] = useState<string>(c.businessHours?.start || '08:00');
  const [bhEnd, setBhEnd] = useState<string>(c.businessHours?.end || '18:00');
  const [bhWeekdays, setBhWeekdays] = useState<number[]>(c.businessHours?.weekdays || [1, 2, 3, 4, 5]);
  const [outsideBehavior, setOutsideBehavior] = useState<string>(c.outsideHoursBehavior || 'schedule_next_business_day');

  // Modo avançado (JSON)
  const [advanced, setAdvanced] = useState(false);
  const [conditionsText, setConditionsText] = useState(JSON.stringify(c, null, 2));

  // Painel de variáveis
  const [showVarsPanel, setShowVarsPanel] = useState(false);
  const messageRef = React.useRef<HTMLTextAreaElement>(null);

  const insertVariable = (token: string) => {
    const ta = messageRef.current;
    if (!ta) {
      setMessageTemplate(prev => prev + token);
      return;
    }
    const start = ta.selectionStart ?? messageTemplate.length;
    const end = ta.selectionEnd ?? messageTemplate.length;
    const next = messageTemplate.slice(0, start) + token + messageTemplate.slice(end);
    setMessageTemplate(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const toggleWeekday = (d: number) => {
    setBhWeekdays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  };

  const buildConditions = (): Record<string, any> => {
    const cond: Record<string, any> = {};
    if (trigger === 'status_change') {
      if (fromStatus) cond.fromStatus = fromStatus;
      if (toStatus) cond.toStatus = toStatus;
    }
    if (trigger === 'time_based') {
      if (daysBeforeExpiry) cond.daysBeforeExpiry = Number(daysBeforeExpiry);
      if (daysAfterDelivery) cond.daysAfterDelivery = Number(daysAfterDelivery);
      if (daysInSameStatus) cond.daysInSameStatus = Number(daysInSameStatus);
      if (statusCond) cond.status = statusCond;
    }
    if (trigger === 'overdue' && statusCond) {
      cond.status = statusCond;
    }
    if ((action === 'whatsapp' || action === 'email') && messageTemplate.trim()) {
      cond.messageTemplate = messageTemplate.trim();
    }
    if (respectBH) {
      cond.respectBusinessHours = true;
      cond.businessHours = {
        start: bhStart,
        end: bhEnd,
        weekdays: bhWeekdays,
        timezone: 'America/Sao_Paulo',
      };
      cond.outsideHoursBehavior = outsideBehavior;
      if (outsideBehavior === 'schedule_next_business_day') {
        cond.scheduleAt = 'start_of_business_hours';
      }
    }
    return cond;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    let conditions: Record<string, any>;
    if (advanced) {
      try {
        conditions = conditionsText.trim() ? JSON.parse(conditionsText) : {};
      } catch {
        toast.error('Condições: JSON inválido');
        return;
      }
    } else {
      conditions = buildConditions();
    }
    onSubmit({ name: name.trim(), description: description.trim() || null, trigger, action, conditions, enabled });
  };

  const switchToAdvanced = () => {
    setConditionsText(JSON.stringify(buildConditions(), null, 2));
    setAdvanced(true);
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-bold">{rule ? 'Editar Regra' : 'Nova Regra de Automação'}</h3>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={submit} className="p-4 space-y-4">
            <div>
              <label className="text-sm font-medium">Nome *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <textarea
                value={description || ''}
                onChange={e => setDescription(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Trigger</label>
                <select
                  value={trigger}
                  onChange={e => setTrigger(e.target.value as TriggerType)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                >
                  {Object.entries(TRIGGER_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Ação</label>
                <select
                  value={action}
                  onChange={e => setAction(e.target.value as ActionType)}
                  className="w-full mt-1 px-3 py-2 border rounded-lg"
                >
                  {Object.entries(ACTION_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Condições estruturadas */}
            <div className="border rounded-lg p-3 space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Condições</span>
                {!advanced ? (
                  <button type="button" onClick={switchToAdvanced} className="text-xs text-primary hover:underline">
                    Modo avançado (JSON)
                  </button>
                ) : (
                  <button type="button" onClick={() => setAdvanced(false)} className="text-xs text-primary hover:underline">
                    Voltar ao formulário
                  </button>
                )}
              </div>

              {!advanced && (
                <>
                  {trigger === 'status_change' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">De (opcional)</label>
                        <select value={fromStatus} onChange={e => setFromStatus(e.target.value)} className="w-full mt-1 px-2 py-1.5 border rounded text-sm">
                          <option value="">— Qualquer —</option>
                          {ORDER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Para *</label>
                        <select value={toStatus} onChange={e => setToStatus(e.target.value)} className="w-full mt-1 px-2 py-1.5 border rounded text-sm">
                          <option value="">— Selecione —</option>
                          {ORDER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {trigger === 'time_based' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground">Dias antes do vencimento</label>
                          <input type="number" min={0} value={daysBeforeExpiry} onChange={e => setDaysBeforeExpiry(e.target.value)} className="w-full mt-1 px-2 py-1.5 border rounded text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Dias após entrega</label>
                          <input type="number" min={0} value={daysAfterDelivery} onChange={e => setDaysAfterDelivery(e.target.value)} className="w-full mt-1 px-2 py-1.5 border rounded text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Dias no mesmo status</label>
                          <input type="number" min={0} value={daysInSameStatus} onChange={e => setDaysInSameStatus(e.target.value)} className="w-full mt-1 px-2 py-1.5 border rounded text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Status do pedido (opcional)</label>
                        <select value={statusCond} onChange={e => setStatusCond(e.target.value)} className="w-full mt-1 px-2 py-1.5 border rounded text-sm">
                          <option value="">— Qualquer —</option>
                          {ORDER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {trigger === 'overdue' && (
                    <div>
                      <label className="text-xs text-muted-foreground">Status do pedido vencido</label>
                      <select value={statusCond} onChange={e => setStatusCond(e.target.value)} className="w-full mt-1 px-2 py-1.5 border rounded text-sm">
                        <option value="">— Qualquer —</option>
                        {ORDER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  )}

                  {trigger === 'manual' && (
                    <p className="text-xs text-muted-foreground italic">Esta regra só será executada manualmente pelo botão "Executar".</p>
                  )}

                  {(action === 'whatsapp' || action === 'email') && (
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-muted-foreground">Mensagem</label>
                        <button
                          type="button"
                          onClick={() => setShowVarsPanel(v => !v)}
                          className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                        >
                          <Braces className="w-3 h-3" />
                          {showVarsPanel ? 'Ocultar variáveis' : 'Inserir variáveis'}
                        </button>
                      </div>
                      <textarea
                        ref={messageRef}
                        value={messageTemplate}
                        onChange={e => setMessageTemplate(e.target.value)}
                        className="w-full mt-1 px-2 py-1.5 border rounded text-sm"
                        rows={3}
                        placeholder="Olá {{customerName}}! Seu pedido #{{orderNumber}} foi finalizado..."
                      />
                      {showVarsPanel && (
                        <VariablesPanel onInsert={insertVariable} />
                      )}
                    </div>
                  )}

                  {/* Horário de expediente */}
                  <div className="border-t pt-3">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input type="checkbox" checked={respectBH} onChange={e => setRespectBH(e.target.checked)} />
                      Respeitar horário de expediente
                    </label>
                    {respectBH && (
                      <div className="mt-2 space-y-2 pl-6">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Início</label>
                            <input type="time" value={bhStart} onChange={e => setBhStart(e.target.value)} className="w-full mt-1 px-2 py-1.5 border rounded text-sm" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Fim</label>
                            <input type="time" value={bhEnd} onChange={e => setBhEnd(e.target.value)} className="w-full mt-1 px-2 py-1.5 border rounded text-sm" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">Dias da semana</label>
                          <div className="flex flex-wrap gap-1">
                            {WEEKDAYS.map(d => {
                              const active = bhWeekdays.includes(d.value);
                              return (
                                <button
                                  key={d.value}
                                  type="button"
                                  onClick={() => toggleWeekday(d.value)}
                                  className={`px-2 py-1 rounded text-xs border ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-white border-slate-300'}`}
                                >
                                  {d.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Se fora do expediente</label>
                          <select value={outsideBehavior} onChange={e => setOutsideBehavior(e.target.value)} className="w-full mt-1 px-2 py-1.5 border rounded text-sm">
                            <option value="schedule_next_business_day">Agendar para o próximo dia útil (início do expediente)</option>
                            <option value="send_immediately">Enviar mesmo assim</option>
                            <option value="skip">Não enviar</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {advanced && (
                <div>
                  <textarea
                    value={conditionsText}
                    onChange={e => setConditionsText(e.target.value)}
                    className="w-full px-2 py-1.5 border rounded font-mono text-xs"
                    rows={8}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Edição manual do JSON de condições. Use o formulário se preferir.
                  </p>
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
              Regra ativa
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

interface VariableGroup {
  title: string;
  items: { token: string; label: string }[];
}

const VARIABLE_GROUPS: VariableGroup[] = [
  {
    title: 'Pedido',
    items: [
      { token: '{{orderNumber}}', label: 'Nº do pedido (ex: PED-000001)' },
      { token: '{{orderTotal}}', label: 'Valor total (R$)' },
      { token: '{{orderTotalPaid}}', label: 'Valor já pago (R$)' },
      { token: '{{orderTotalPending}}', label: 'Saldo pendente (R$)' },
      { token: '{{orderStatus}}', label: 'Status atual' },
      { token: '{{orderItemsCount}}', label: 'Qtd. de itens distintos' },
      { token: '{{orderItemsQuantity}}', label: 'Qtd. total (soma)' },
      { token: '{{orderFirstItem}}', label: 'Nome do 1º produto' },
      { token: '{{orderCreatedAt}}', label: 'Data de criação' },
      { token: '{{validUntil}}', label: 'Validade do orçamento' },
      { token: '{{publicLink}}', label: 'Link público de acompanhamento (gerado automaticamente)' },
    ],
  },
  {
    title: 'Cliente',
    items: [
      { token: '{{customerName}}', label: 'Nome' },
      { token: '{{customerPhone}}', label: 'Telefone' },
      { token: '{{customerEmail}}', label: 'E-mail' },
      { token: '{{customerDocument}}', label: 'CPF / CNPJ' },
      { token: '{{customerCity}}', label: 'Cidade' },
    ],
  },
];

const VariablesPanel: React.FC<{ onInsert: (token: string) => void }> = ({ onInsert }) => {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(token);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mt-2 border rounded-lg bg-white p-2 space-y-2 max-h-56 overflow-auto">
      {VARIABLE_GROUPS.map(group => (
        <div key={group.title}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">{group.title}</p>
          <div className="space-y-0.5">
            {group.items.map(v => (
              <div key={v.token} className="flex items-center justify-between gap-2 px-1.5 py-1 rounded hover:bg-slate-50">
                <button
                  type="button"
                  onClick={() => onInsert(v.token)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  title="Inserir na mensagem"
                >
                  <code className="text-[11px] bg-slate-100 px-1.5 py-0.5 rounded shrink-0">{v.token}</code>
                  <span className="text-[11px] text-muted-foreground truncate">{v.label}</span>
                </button>
                <button
                  type="button"
                  onClick={() => copy(v.token)}
                  className="p-1 rounded hover:bg-slate-200 text-muted-foreground"
                  title="Copiar"
                >
                  {copied === v.token ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
