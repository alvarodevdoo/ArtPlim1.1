import { Settings, Shield, Lock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SystemSettingsData {
  id: string;
  enableWMS: boolean;
  enableProduction: boolean;
  enableFinance: boolean;
  enableFinanceReports: boolean;
  enableAutomation: boolean;
  defaultMarkup: number;
  taxRate: number;
  validadeOrcamento: number;
  allowDuplicatePhones: boolean;
  requireDocumentKeyForEntry: boolean;
  enableCategoryAppropriation: boolean;
  inventoryValuationMethod: string;
  defaultSalesUnit: string;
  freightExpenseAccountId?: string;
  taxExpenseAccountId?: string;
  nfeCertificate?: string | null;
  nfeCertificatePassword?: string | null;
  nfeCertificateExpiry?: string | null;
}

interface SystemSettingsProps {
  settings: SystemSettingsData;
  setSettings: React.Dispatch<React.SetStateAction<SystemSettingsData>>;
  handleSaveSettings: (e: React.FormEvent) => Promise<void>;
  loading: boolean;
}

export const SystemSettings: React.FC<SystemSettingsProps> = ({
  settings,
  setSettings,
  handleSaveSettings,
  loading
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurações do Sistema</CardTitle>
        <CardDescription>Configure o comportamento global do ERP.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSaveSettings} className="max-w-2xl space-y-8">
          {/* Seção 1: Módulos do Sistema */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2 text-sm text-primary border-b pb-2">
              <Settings className="w-4 h-4" /> Módulos Ativos no ERP
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center justify-between p-4 border rounded-xl hover:bg-slate-50 transition-all cursor-pointer group shadow-sm bg-card/50">
                <div className="pr-4">
                  <span className="text-sm font-bold block group-hover:text-primary transition-colors">Estoque (WMS)</span>
                  <p className="text-[10px] text-muted-foreground leading-tight">Gestão de endereçamento e picking avançado.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableWMS}
                  onChange={(e) => setSettings(prev => ({ ...prev, enableWMS: e.target.checked }))}
                  className="w-5 h-5 rounded-md border-input text-primary focus:ring-primary shadow-inner"
                />
              </label>

              <label className="flex items-center justify-between p-4 border rounded-xl hover:bg-slate-50 transition-all cursor-pointer group shadow-sm bg-card/50">
                <div className="pr-4">
                  <span className="text-sm font-bold block group-hover:text-primary transition-colors">Produção (PCP)</span>
                  <p className="text-[10px] text-muted-foreground leading-tight">Controle de ordens fabris e etapas produtivas.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableProduction}
                  onChange={(e) => setSettings(prev => ({ ...prev, enableProduction: e.target.checked }))}
                  className="w-5 h-5 rounded-md border-input text-primary focus:ring-primary shadow-inner"
                />
              </label>

              <label className="flex items-center justify-between p-4 border rounded-xl hover:bg-slate-50 transition-all cursor-pointer group shadow-sm bg-card/50">
                <div className="pr-4">
                  <span className="text-sm font-bold block group-hover:text-primary transition-colors">Automação Financeira</span>
                  <p className="text-[10px] text-muted-foreground leading-tight">Liquidação de parcelas e conciliação de taxas.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableAutomation}
                  onChange={(e) => setSettings(prev => ({ ...prev, enableAutomation: e.target.checked }))}
                  className="w-5 h-5 rounded-md border-input text-primary focus:ring-primary shadow-inner"
                />
              </label>

              <label className="flex items-center justify-between p-4 border rounded-xl hover:bg-slate-50 transition-all cursor-pointer group shadow-sm bg-card/50 col-span-full">
                <div className="pr-4">
                  <span className="text-sm font-bold block group-hover:text-primary transition-colors flex items-center gap-2">
                    Apropriação Contábil por Categoria
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/10 text-primary">Recomendado</span>
                  </span>
                  <p className="text-[10px] text-muted-foreground leading-tight max-w-md">
                    Ao selecionar a categoria de um insumo, o sistema sugere automaticamente as contas contábeis (estoque e despesa) previamente configuradas.<br/>
                    <span className="text-amber-500 font-semibold">Desabilitar removerá a automação de contas na importação de NF-e e no cadastro de insumos.</span>
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableCategoryAppropriation ?? true}
                  onChange={(e) => setSettings(prev => ({ ...prev, enableCategoryAppropriation: e.target.checked }))}
                  className="w-5 h-5 rounded-md border-input text-primary focus:ring-primary shadow-inner"
                />
              </label>
            </div>
          </div>

          {/* Seção 2: Regras de Negócio */}
          <div className="space-y-6 pt-2">
            <h4 className="font-medium flex items-center gap-2 text-sm text-primary border-b pb-2">
               Comportamento do Sistema
            </h4>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Validade do Orçamento (dias)</label>
                  <div className="relative group">
                    <Input
                      type="number"
                      className="pl-10 h-11 border-muted-foreground/20 focus:border-primary focus:ring-primary transition-all rounded-lg"
                      value={settings.validadeOrcamento}
                      onChange={(e) => setSettings(prev => ({ ...prev, validadeOrcamento: parseInt(e.target.value) }))}
                    />
                    <Settings className="w-4 h-4 absolute left-3 top-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <label className="flex items-center justify-between p-4 border rounded-xl hover:border-primary/30 transition-all cursor-pointer bg-muted/20">
                  <span className="text-xs font-bold uppercase tracking-wide">Telefones Duplicados</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-medium text-muted-foreground">{settings.allowDuplicatePhones ? 'Permitido' : 'Bloqueado'}</span>
                    <input
                      type="checkbox"
                      checked={settings.allowDuplicatePhones}
                      onChange={(e) => setSettings(prev => ({ ...prev, allowDuplicatePhones: e.target.checked }))}
                      className="w-5 h-5 rounded-md border-input text-primary"
                    />
                  </div>
                </label>

                <label className="flex items-center justify-between p-4 border rounded-xl hover:border-primary/30 transition-all cursor-pointer bg-muted/20">
                  <span className="text-xs font-bold uppercase tracking-wide">Chave NF nas Entradas</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-medium text-muted-foreground">{settings.requireDocumentKeyForEntry ? 'Exigir' : 'Opcional'}</span>
                    <input
                      type="checkbox"
                      checked={settings.requireDocumentKeyForEntry}
                      onChange={(e) => setSettings(prev => ({ ...prev, requireDocumentKeyForEntry: e.target.checked }))}
                      className="w-5 h-5 rounded-md border-input text-primary"
                    />
                  </div>
                </label>

                <label className="flex items-center justify-between p-4 border rounded-xl hover:border-primary/30 transition-all cursor-pointer bg-muted/20">
                  <span className="text-xs font-bold uppercase tracking-wide">Método de Custeio</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-medium text-muted-foreground">{settings.inventoryValuationMethod === 'PEPS' ? 'PEPS (FIFO)' : 'Média Ponderada'}</span>
                    <input
                      type="checkbox"
                      checked={settings.inventoryValuationMethod === 'PEPS'}
                      onChange={(e) => setSettings(prev => ({ ...prev, inventoryValuationMethod: e.target.checked ? 'PEPS' : 'AVERAGE' }))}
                      className="w-5 h-5 rounded-md border-input text-primary"
                    />
                  </div>
                </label>

                <div className="flex flex-col p-4 border rounded-xl bg-slate-50 border-slate-200">
                  <span className="text-xs font-bold uppercase tracking-wide mb-2 text-slate-600">Unidade de Medida Padrão (Vendas)</span>
                  <div className="flex gap-2">
                    {(['M', 'CM', 'MM'] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setSettings(prev => ({ ...prev, defaultSalesUnit: u }))}
                        className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${
                          settings.defaultSalesUnit === u 
                          ? 'bg-indigo-600 text-white shadow-md scale-105' 
                          : 'bg-white border text-slate-500 hover:border-indigo-300'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-slate-400 mt-2 italic">Define a unidade inicial ao abrir o configurador de itens.</p>
                </div>
              </div>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full md:w-auto px-10 shadow-lg">
            {loading ? 'Sincronizando...' : 'Salvar Configurações do Sistema'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
