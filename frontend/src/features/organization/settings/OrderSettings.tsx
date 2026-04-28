import React from 'react';
import { ShoppingCart, CreditCard, Truck, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

interface OrderSettingsData {
  requireOrderDeposit: boolean;
  minDepositPercent: number;
  allowDeliveryWithBalance: boolean;
  defaultDueDateDays: number;
}

interface OrderSettingsProps {
  settings: OrderSettingsData;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
  handleSaveSettings: (e: React.FormEvent) => Promise<void>;
  loading: boolean;
}

export const OrderSettings: React.FC<OrderSettingsProps> = ({
  settings,
  setSettings,
  handleSaveSettings,
  loading
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Regras de Negócio de Pedidos</CardTitle>
        <CardDescription>Defina travas de segurança e políticas de faturamento para suas vendas.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSaveSettings} className="max-w-2xl space-y-8">
          
          {/* Seção 1: Garantia Financeira (Entrada) */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2 text-sm text-primary border-b pb-2">
              <CreditCard className="w-4 h-4" /> Garantia Financeira (Sinal)
            </h4>
            
            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 border rounded-xl hover:bg-slate-50 transition-all cursor-pointer group shadow-sm bg-card/50">
                <div className="pr-4">
                  <span className="text-sm font-bold block group-hover:text-primary transition-colors">Exigir Pagamento de Entrada</span>
                  <p className="text-[10px] text-muted-foreground leading-tight">O sistema sinalizará a necessidade de um sinal antes de iniciar a produção.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.requireOrderDeposit ?? false}
                  onChange={(e) => setSettings((prev: any) => ({ ...prev, requireOrderDeposit: e.target.checked }))}
                  className="w-5 h-5 rounded-md border-input text-primary focus:ring-primary shadow-inner"
                />
              </label>

              {(settings.requireOrderDeposit ?? false) && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 bg-slate-50 border rounded-xl space-y-3">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Porcentagem Mínima de Entrada (%)</label>
                    <div className="relative group max-w-[200px]">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        className="pl-8 h-10 border-muted-foreground/20 focus:border-primary focus:ring-primary transition-all rounded-lg"
                        value={settings.minDepositPercent || ''}
                        onChange={(e) => setSettings((prev: any) => ({ ...prev, minDepositPercent: parseFloat(e.target.value) || 0 }))}
                      />
                      <span className="absolute left-3 top-2.5 text-muted-foreground text-xs font-bold">%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Seção 2: Política de Entrega e Faturamento */}
          <div className="space-y-4 pt-2">
            <h4 className="font-medium flex items-center gap-2 text-sm text-primary border-b pb-2">
              <Truck className="w-4 h-4" /> Entrega e Faturamento (Pagar Depois)
            </h4>
            
            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 border rounded-xl hover:bg-slate-50 transition-all cursor-pointer group shadow-sm bg-card/50">
                <div className="pr-4">
                  <span className="text-sm font-bold block group-hover:text-primary transition-colors">Permitir Retirada com Saldo em Aberto</span>
                  <p className="text-[10px] text-muted-foreground leading-tight">O cliente pode levar o material e pagar o restante posteriormente.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowDeliveryWithBalance ?? false}
                  onChange={(e) => setSettings((prev: any) => ({ ...prev, allowDeliveryWithBalance: e.target.checked }))}
                  className="w-5 h-5 rounded-md border-input text-primary focus:ring-primary shadow-inner"
                />
              </label>

              {(settings.allowDeliveryWithBalance ?? false) && (
                <div className="p-4 bg-indigo-50/30 border border-indigo-100 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center gap-2 mb-1">
                     <Calendar className="w-4 h-4 text-indigo-500" />
                     <label className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Prazo de Vencimento Padrão (Dias)</label>
                  </div>
                  <div className="relative group max-w-[200px]">
                    <Input
                      type="number"
                      min="0"
                      placeholder="Ex: 15"
                      className="pl-3 h-10 border-indigo-200 focus:border-indigo-500 focus:ring-indigo-500 transition-all rounded-lg"
                      value={settings.defaultDueDateDays || ''}
                      onChange={(e) => setSettings((prev: any) => ({ ...prev, defaultDueDateDays: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <p className="text-[10px] text-indigo-600/70 italic">Define quantos dias para o vencimento da conta a receber gerada no faturamento.</p>
                </div>
              )}
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full md:w-auto px-10 shadow-lg">
            {loading ? 'Salvando Regras...' : 'Salvar Regras de Pedidos'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
