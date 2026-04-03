import React, { useState, useEffect } from 'react';
import { Pencil, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Combobox } from '@/components/ui/Combobox';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// Reusing the type structure we need
interface OrganizationSettings {
  freightExpenseAccountId?: string;
  taxExpenseAccountId?: string;
}

interface FinanceIntegrationSettingsProps {
  settings: OrganizationSettings;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
  handleSaveSettings: (e: React.FormEvent) => Promise<void>;
  loading: boolean;
}

export const FinanceIntegrationSettings: React.FC<FinanceIntegrationSettingsProps> = ({
  settings,
  setSettings,
  handleSaveSettings,
  loading
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setFetching(true);
        const res = await api.get('/api/finance/v2/chart-of-accounts?flat=true');
        const data = res.data.data || [];
        // Filtrar apenas contas Analíticas para poder receber lançamentos manuais
        const analytics = data.filter((acc: any) => acc.type === 'ANALYTIC');
        setAccounts(analytics);
      } catch (error) {
        toast.error('Erro ao buscar o Plano de Contas.');
      } finally {
        setFetching(false);
      }
    };
    fetchAccounts();
  }, []);

  const comboboxOptions = accounts.map(a => ({
    id: a.id, // we might be saving the ID or the code? Usually the ID if it's the FK
    label: `${a.code} - ${a.name}`,
    // If we wanted to search by code or name
  }));

  // Attempt to resolve the current selection to display if not editing
  const getDisplayValue = (val: string | undefined) => {
    if (!val) return 'Não configurado';
    const acc = accounts.find(a => a.id === val || a.code === val);
    return acc ? `${acc.code} - ${acc.name}` : val;
  };

  const overrideSave = async (e: React.FormEvent) => {
    await handleSaveSettings(e);
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Integração de Compras (NF-e)</CardTitle>
          <CardDescription>Mapeie as contas contábeis padrão para despesas acessórias e passivos de impostos lidos nas Notas Fiscais dos fornecedores.</CardDescription>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsEditing(!isEditing)}
          className={`h-8 w-8 transition-colors ${isEditing ? 'text-primary bg-primary/10' : 'text-slate-400 hover:text-slate-600'}`}
          title={isEditing ? 'Cancelar Edição' : 'Editar Vínculos'}
        >
          <Pencil size={16} />
        </Button>
      </CardHeader>
      <CardContent>
        {fetching ? (
           <div className="flex items-center gap-2 text-sm text-slate-400 py-4"><Loader2 size={16} className="animate-spin" /> Carregando contas...</div>
        ) : (
          <form onSubmit={overrideSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">Conta p/ Custos Acessórios (Frete CIF/FOB)</label>
                  <p className="text-[10px] text-muted-foreground leading-tight mb-2">Conta de Custo Logístico para rateio de fretes (Sugestão: 4.1.2.01).</p>
                  {isEditing ? (
                    <Combobox
                      options={comboboxOptions}
                      value={settings.freightExpenseAccountId || ''}
                      onChange={(val) => setSettings((prev: any) => ({ ...prev, freightExpenseAccountId: val }))}
                      placeholder="Selecione a conta analítica"
                      className="w-full h-10 border-slate-200"
                    />
                  ) : (
                    <div className="h-10 px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm text-slate-600 truncate flex items-center font-mono">
                      {getDisplayValue(settings.freightExpenseAccountId)}
                    </div>
                  )}
              </div>
              <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">Conta p/ Impostos Mapeados (DIFAL / ST)</label>
                  <p className="text-[10px] text-muted-foreground leading-tight mb-2">Conta do passivo para guias de impostos acessórios (Sugestão: 2.1.3.05).</p>
                  {isEditing ? (
                    <Combobox
                      options={comboboxOptions}
                      value={settings.taxExpenseAccountId || ''}
                      onChange={(val) => setSettings((prev: any) => ({ ...prev, taxExpenseAccountId: val }))}
                      placeholder="Selecione a conta analítica"
                      className="w-full h-10 border-slate-200"
                    />
                  ) : (
                    <div className="h-10 px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm text-slate-600 truncate flex items-center font-mono">
                       {getDisplayValue(settings.taxExpenseAccountId)}
                    </div>
                  )}
              </div>
            </div>
            
            {isEditing && (
              <div className="flex justify-end gap-3 pt-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setIsEditing(false)} 
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading} className="px-10 shadow-lg">
                  {loading ? 'Salvando...' : 'Salvar Mapeamentos NF-e'}
                </Button>
              </div>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
};
