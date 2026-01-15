import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  Bell,
  Clock,
  MessageSquare,
  Calendar,
  AlertTriangle,
  Settings,
  Zap,
  Target,
  TrendingUp,
  Loader2
} from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: 'status_change' | 'time_based' | 'overdue' | 'manual';
  action: 'whatsapp' | 'email' | 'notification' | 'status_update';
  conditions: any;
  enabled: boolean;
  lastRun?: string;
  runCount: number;
}

interface OrderAutomationProps {
  orders: any[];
  onRuleExecute?: (ruleId: string, orderIds: string[]) => void;
}

export const OrderAutomation: React.FC<OrderAutomationProps> = ({
  orders,
  onRuleExecute
}) => {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [activeTab, setActiveTab] = useState<'rules' | 'insights' | 'schedule'>('rules');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [automationEnabled, setAutomationEnabled] = useState(true);

  useEffect(() => {
    loadAutomationRules();
    loadAutomationSettings();
  }, []);

  const loadAutomationSettings = async () => {
    try {
      const response = await api.get('/api/organization/settings');
      if (response.data.success) {
        setAutomationEnabled(response.data.data.enableAutomation ?? true);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações de automação:', error);
    }
  };

  const loadAutomationRules = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/sales/automation/rules');
      if (response.data.success) {
        setRules(response.data.data);
      } else {
        toast.error('Erro ao carregar regras de automação');
      }
    } catch (error) {
      console.error('Erro ao carregar regras:', error);
      toast.error('Erro ao carregar regras de automação');
      // Fallback para regras padrão em caso de erro
      setRules(getDefaultRules());
    } finally {
      setLoading(false);
    }
  };

  // Regras padrão como fallback
  const getDefaultRules = (): AutomationRule[] => [
    {
      id: '1',
      name: 'Lembrete de Orçamento Vencendo',
      description: 'Envia WhatsApp 1 dia antes do vencimento do orçamento',
      trigger: 'time_based',
      action: 'whatsapp',
      conditions: { daysBeforeExpiry: 1, status: 'DRAFT' },
      enabled: true,
      runCount: 0
    },
    {
      id: '2',
      name: 'Notificação de Produção Iniciada',
      description: 'Notifica cliente quando pedido entra em produção',
      trigger: 'status_change',
      action: 'whatsapp',
      conditions: { fromStatus: 'APPROVED', toStatus: 'IN_PRODUCTION' },
      enabled: true,
      runCount: 0
    },
    {
      id: '3',
      name: 'Follow-up Pós-Entrega',
      description: 'Envia pesquisa de satisfação 3 dias após entrega',
      trigger: 'time_based',
      action: 'whatsapp',
      conditions: { daysAfterDelivery: 3, status: 'DELIVERED' },
      enabled: false,
      runCount: 0
    },
    {
      id: '4',
      name: 'Alerta de Pedido Parado',
      description: 'Alerta interno para pedidos há mais de 5 dias no mesmo status',
      trigger: 'time_based',
      action: 'notification',
      conditions: { daysInSameStatus: 5 },
      enabled: true,
      runCount: 0
    }
  ];

  const toggleRule = async (ruleId: string) => {
    if (!automationEnabled) {
      toast.error('Automações estão desabilitadas nas configurações da organização');
      return;
    }

    try {
      setSaving(true);
      const response = await api.patch(`/api/sales/automation/rules/${ruleId}/toggle`);

      if (response.data.success) {
        setRules(prev => prev.map(rule =>
          rule.id === ruleId ? response.data.data : rule
        ));
        toast.success('Regra atualizada com sucesso!');
      } else {
        toast.error('Erro ao atualizar regra');
      }
    } catch (error) {
      console.error('Erro ao alternar regra:', error);
      toast.error('Erro ao atualizar regra');
    } finally {
      setSaving(false);
    }
  };

  const executeRule = async (rule: AutomationRule) => {
    if (!automationEnabled) {
      toast.error('Automações estão desabilitadas nas configurações da organização');
      return;
    }

    let affectedOrders: string[] = [];

    // Simular lógica de execução baseada nas condições
    switch (rule.trigger) {
      case 'time_based':
        if (rule.conditions.daysBeforeExpiry) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + rule.conditions.daysBeforeExpiry);

          affectedOrders = orders
            .filter(order =>
              order.status === rule.conditions.status &&
              order.validUntil &&
              new Date(order.validUntil).toDateString() === tomorrow.toDateString()
            )
            .map(order => order.id);
        }
        break;

      case 'overdue':
        affectedOrders = orders
          .filter(order =>
            order.status === 'DRAFT' &&
            order.validUntil &&
            new Date(order.validUntil) < new Date()
          )
          .map(order => order.id);
        break;
    }

    try {
      setSaving(true);
      const response = await api.post(`/api/sales/automation/rules/${rule.id}/execute`, {
        orderIds: affectedOrders
      });

      if (response.data.success) {
        // Atualizar a regra local com os novos dados
        setRules(prev => prev.map(r =>
          r.id === rule.id
            ? { ...r, runCount: r.runCount + affectedOrders.length, lastRun: response.data.data.executedAt }
            : r
        ));

        if (onRuleExecute) {
          onRuleExecute(rule.id, affectedOrders);
        }

        toast.success(`Regra executada para ${affectedOrders.length} pedido(s)!`);
      } else {
        toast.error('Erro ao executar regra');
      }
    } catch (error) {
      console.error('Erro ao executar regra:', error);
      toast.error('Erro ao executar regra');
    } finally {
      setSaving(false);
    }
  };

  const getInsights = () => {
    const totalOrders = orders.length;
    const overdueOrders = orders.filter(o =>
      o.status === 'DRAFT' && o.validUntil && new Date(o.validUntil) < new Date()
    ).length;

    const avgProcessingTime = 3.2; // Simulado
    const conversionRate = 78; // Simulado

    return {
      totalOrders,
      overdueOrders,
      avgProcessingTime,
      conversionRate,
      automationSavings: rules.reduce((sum, rule) => sum + rule.runCount, 0) * 5 // 5 min por automação
    };
  };

  const insights = getInsights();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Automação de Pedidos</h2>
          <p className="text-muted-foreground">
            Automatize follow-ups e notificações para melhorar a experiência do cliente
          </p>
          {!automationEnabled && (
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">
                  Automações desabilitadas nas configurações da organização
                </span>
              </div>
            </div>
          )}
        </div>
        <Button>
          <Settings className="w-4 h-4 mr-2" />
          Configurar
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
        {[
          { id: 'rules', label: 'Regras', icon: Zap },
          { id: 'insights', label: 'Insights', icon: TrendingUp },
          { id: 'schedule', label: 'Agenda', icon: Calendar }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab(tab.id as any)}
            >
              <Icon className="w-4 h-4 mr-2" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Carregando regras de automação...</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rules.map(rule => (
                <Card key={rule.id} className={`${rule.enabled && automationEnabled ? 'border-green-200' : 'border-gray-200'} ${!automationEnabled ? 'opacity-60' : ''}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${rule.enabled && automationEnabled ? 'bg-green-500' : 'bg-gray-400'
                            }`} />
                          <span>{rule.name}</span>
                        </CardTitle>
                        <CardDescription>{rule.description}</CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleRule(rule.id)}
                        disabled={saving || !automationEnabled}
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          rule.enabled ? 'Desativar' : 'Ativar'
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Trigger:</span>
                        <span className="capitalize">{rule.trigger.replace('_', ' ')}</span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Ação:</span>
                        <span className="capitalize">{rule.action}</span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Execuções:</span>
                        <span className="font-medium">{rule.runCount}</span>
                      </div>

                      {rule.lastRun && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Última execução:</span>
                          <span>{formatDateTime(rule.lastRun)}</span>
                        </div>
                      )}

                      {rule.enabled && automationEnabled && (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => executeRule(rule)}
                          disabled={saving}
                        >
                          {saving ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Zap className="w-4 h-4 mr-2" />
                          )}
                          Executar Agora
                        </Button>
                      )}

                      {!automationEnabled && (
                        <Button
                          size="sm"
                          className="w-full"
                          disabled
                          variant="outline"
                        >
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          Automação Desabilitada
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Insights Tab */}
      {activeTab === 'insights' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pedidos Ativos</p>
                  <p className="text-2xl font-bold">{insights.totalOrders}</p>
                </div>
                <Target className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Vencidos</p>
                  <p className="text-2xl font-bold text-red-600">{insights.overdueOrders}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tempo Médio</p>
                  <p className="text-2xl font-bold">{insights.avgProcessingTime}d</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Taxa Conversão</p>
                  <p className="text-2xl font-bold text-green-600">{insights.conversionRate}%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 lg:col-span-4">
            <CardHeader>
              <CardTitle>Economia com Automação</CardTitle>
              <CardDescription>
                Tempo economizado com automações este mês
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Tempo economizado</span>
                    <span className="text-sm text-muted-foreground">
                      {insights.automationSavings} minutos
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${Math.min((insights.automationSavings / 500) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-600">
                    {Math.round(insights.automationSavings / 60)}h
                  </p>
                  <p className="text-sm text-muted-foreground">economizadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <Card>
          <CardHeader>
            <CardTitle>Próximas Automações</CardTitle>
            <CardDescription>
              Automações agendadas para execução
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  time: '14:00 hoje',
                  rule: 'Lembrete de Orçamento Vencendo',
                  orders: 3,
                  type: 'whatsapp'
                },
                {
                  time: '09:00 amanhã',
                  rule: 'Follow-up Pós-Entrega',
                  orders: 1,
                  type: 'whatsapp'
                },
                {
                  time: '16:00 amanhã',
                  rule: 'Alerta de Pedido Parado',
                  orders: 2,
                  type: 'notification'
                }
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-full">
                      {item.type === 'whatsapp' ? (
                        <MessageSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Bell className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{item.rule}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.orders} pedido(s) • {item.time}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Executar
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};