import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import { CheckCircle, AlertCircle, Clock, DollarSign, Plus, Calculator, Trash2, Edit2, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Supplier {
  id: string;
  name: string;
  document: string | null;
}

interface AccountPayable {
  id: string;
  amount: number;
  balanceDue: number;
  dueDate: string;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED';
  supplier: { id: string; name: string };
  _count: { receipts: number };
}

interface BankAccount {
  id: string;
  name: string;
  balance: number;
  type: string;
}

interface ReceiptSummary {
  supplierId: string;
  supplierName: string;
  supplierDocument: string | null;
  count: number;
  total: number;
  receiptIds: string[];
  oldestDate: string;
}

interface RecurringBill {
  id: string;
  name: string;
  description: string | null;
  amount: number;
  dueDay: number;
  active: boolean;
  lastGeneratedAt: string | null;
  supplierId: string | null;
  categoryId: string | null;
}

interface ChartOfAccount {
  id: string;
  name: string;
  code: string;
  type: 'ANALYTIC' | 'SYNTHETIC';
}

export function ContasAPagar() {
  const [payables, setPayables] = useState<AccountPayable[]>([]);
  const [summaries, setSummaries] = useState<ReceiptSummary[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccount[]>([]);
  
  const [loading, setLoading] = useState(true);

  // Modais
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showCloseInvoiceModal, setShowCloseInvoiceModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);

  // Estados de formulário
  const [selectedPayable, setSelectedPayable] = useState<AccountPayable | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<ReceiptSummary | null>(null);
  const [selectedRecurring, setSelectedRecurring] = useState<RecurringBill | null>(null);

  const [paymentData, setPaymentData] = useState({ paymentAccountId: '', amountPaid: '', notes: '' });
  const [receiptData, setReceiptData] = useState({ supplierId: '', totalAmount: '', notes: '', issueDate: new Date().toISOString().split('T')[0] });
  const [closeData, setCloseData] = useState({ dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], stockAccountId: '', supplierAccountId: '', notes: '' });
  const [recurringData, setRecurringData] = useState({ name: '', amount: '', dueDay: '10', supplierId: '', categoryId: '', description: '', active: true });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [payablesRes, summariesRes, recurringRes, accountsRes, suppliersRes, chartRes] = await Promise.all([
        api.get('/api/finance/payables'),
        api.get('/api/insumos/receipts/summary'),
        api.get('/api/finance/recurring-bills'),
        api.get('/api/finance/accounts'),
        api.get('/api/profiles?isSupplier=true'),
        api.get('/api/finance/chart-of-accounts')
      ]);

      setPayables(payablesRes.data.data);
      setSummaries(summariesRes.data.data);
      setRecurringBills(recurringRes.data.data);
      setAccounts(accountsRes.data.data.filter((a: any) => a.type === 'CHECKING' || a.type === 'CASH' || a.type === 'SAVINGS'));
      setSuppliers(suppliersRes.data.data);
      setChartOfAccounts(chartRes.data.data.filter((acc: any) => acc.type === 'ANALYTIC'));
    } catch (error) {
      toast.error('Erro ao carregar dados financeiros');
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers: Pagamento de AccountPayable ---
  const handleOpenPayment = (payable: AccountPayable) => {
    setSelectedPayable(payable);
    setPaymentData({ paymentAccountId: '', amountPaid: (payable.balanceDue || payable.amount).toString(), notes: '' });
    setShowPaymentModal(true);
  };

  const handlePayBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayable) return;
    try {
      await api.post(`/api/finance/payables/${selectedPayable.id}/pay`, {
        paymentAccountId: paymentData.paymentAccountId,
        amountPaid: parseFloat(paymentData.amountPaid),
        notes: paymentData.notes
      });
      toast.success('Pagamento registrado!');
      setShowPaymentModal(false);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro no pagamento');
    }
  };

  // --- Handlers: Novo Recibo de Material ---
  const handleSaveReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/insumos/receipts', {
        supplierId: receiptData.supplierId,
        totalAmount: parseFloat(receiptData.totalAmount),
        issueDate: receiptData.issueDate,
        notes: receiptData.notes
      });
      toast.success('Entrada de material registrada!');
      setShowReceiptModal(false);
      setReceiptData({ supplierId: '', totalAmount: '', notes: '', issueDate: new Date().toISOString().split('T')[0] });
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao salvar recibo');
    }
  };

  // --- Handlers: Fechamento de Fatura (Billing) ---
  const handleOpenCloseInvoice = (summary: ReceiptSummary) => {
    setSelectedSummary(summary);
    // Tenta encontrar contas padrão no Plano de Contas (ids fixos ou configurados seriam melhor, mas vamos deixar livre por ora)
    setCloseData({
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      stockAccountId: '',
      supplierAccountId: '',
      notes: `Fechamento ref. ${summary.count} recibos`
    });
    setShowCloseInvoiceModal(true);
  };

  const handleCloseInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSummary) return;
    try {
      await api.post('/api/insumos/receipts/close', {
        supplierId: selectedSummary.supplierId,
        receiptIds: selectedSummary.receiptIds,
        dueDate: closeData.dueDate,
        stockAccountId: closeData.stockAccountId,
        supplierAccountId: closeData.supplierAccountId,
        notes: closeData.notes
      });
      toast.success('Fatura consolidada e gerada em Contas a Pagar!');
      setShowCloseInvoiceModal(false);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao fechar fatura');
    }
  };

  // --- Handlers: Contas Recorrentes ---
  const handleSaveRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: recurringData.name,
        amount: parseFloat(recurringData.amount),
        dueDay: parseInt(recurringData.dueDay),
        supplierId: recurringData.supplierId || null,
        categoryId: recurringData.categoryId || null,
        description: recurringData.description,
        active: recurringData.active
      };

      if (selectedRecurring) {
        await api.put(`/api/finance/recurring-bills/${selectedRecurring.id}`, payload);
      } else {
        await api.post('/api/finance/recurring-bills', payload);
      }
      toast.success('Conta recorrente salva!');
      setShowRecurringModal(false);
      setSelectedRecurring(null);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao salvar recorrente');
    }
  };

  const handleDeleteRecurring = async (id: string) => {
    if (!confirm('Excluir esta conta recorrente?')) return;
    try {
      await api.delete(`/api/finance/recurring-bills/${id}`);
      toast.success('Removida!');
      loadData();
    } catch (error) {
      toast.error('Erro ao excluir');
    }
  };

  const handleGenerateMonth = async () => {
    const date = new Date();
    if (!confirm(`Gerar cobranças para ${date.getMonth() + 1}/${date.getFullYear()}?`)) return;
    try {
      const res = await api.post('/api/finance/recurring-bills/generate-month', {
        year: date.getFullYear(),
        month: date.getMonth() + 1
      });
      toast.success(`Sucesso! Gerados: ${res.data.data.generated.join(', ')}`);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao gerar cobranças');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <Badge variant="outline" className="text-yellow-600 bg-yellow-50"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
      case 'PAID': return <Badge variant="outline" className="text-green-600 bg-green-50"><CheckCircle className="w-3 h-3 mr-1" /> Pago</Badge>;
      case 'PARTIAL': return <Badge variant="outline" className="text-blue-600 bg-blue-50"><Clock className="w-3 h-3 mr-1" /> Parcial</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando painel financeiro...</div>;

  return (
    <div className="space-y-8 mt-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Contas a Pagar</h1>
          <p className="text-muted-foreground text-sm">Controle de faturas, débitos por fornecedor e custos fixos.</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => setShowReceiptModal(true)} variant="outline" className="borderColor-green-200">
            <Plus className="w-4 h-4 mr-2" /> Novo Recibo Material
          </Button>
          <Button onClick={() => { setSelectedRecurring(null); setRecurringData({ name: '', amount: '', dueDay: '10', supplierId: '', categoryId: '', description: '', active: true }); setShowRecurringModal(true); }}>
            <Calendar className="w-4 h-4 mr-2" /> Nova Conta Recorrente
          </Button>
        </div>
      </div>

      {/* --- SEÇÃO 1: SALDO ABERTO POR FORNECEDOR (RECEIPTS PENDING) --- */}
      <section className="space-y-4">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-orange-100 rounded-lg text-orange-600"><Calculator className="w-5 h-5" /></div>
          <h2 className="text-lg font-bold">Saldo Aberto por Fornecedor (Sob Demanda)</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {summaries.length === 0 ? (
            <Card className="col-span-full border-dashed"><CardContent className="py-8 text-center text-muted-foreground">Nenhum saldo acumulado em fornecedores no momento.</CardContent></Card>
          ) : (
            summaries.map((s) => (
              <Card key={s.supplierId} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base">{s.supplierName}</CardTitle>
                      <CardDescription className="text-xs">{s.supplierDocument || 'Sem documento'}</CardDescription>
                    </div>
                    <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-none">{s.count} entradas</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Acumulado</p>
                      <p className="text-xl font-bold text-orange-600">{formatCurrency(s.total)}</p>
                    </div>
                    <Button size="sm" onClick={() => handleOpenCloseInvoice(s)} className="bg-orange-600 hover:bg-orange-700">Fechar Fatura</Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      {/* --- SEÇÃO 2: FATURAS CONSOLIDADAS (ACCOUNT PAYABLE) --- */}
      <section className="space-y-4">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-green-100 rounded-lg text-green-600"><DollarSign className="w-5 h-5" /></div>
          <h2 className="text-lg font-bold">Faturas Consolidadas a Pagar</h2>
        </div>
        {payables.filter(p => p.status !== 'PAID').length === 0 ? (
          <Card className="border-dashed"><CardContent className="py-8 text-center text-muted-foreground">Nenhum boleto ou fatura vencendo em breve.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {payables.filter(p => p.status !== 'PAID').map((payable) => (
              <Card key={payable.id}>
                <CardContent className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold">{payable.supplier?.name}</span>
                      {getStatusBadge(payable.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Vencimento: <span className={new Date(payable.dueDate) < new Date() ? 'text-red-500 font-bold' : ''}>{new Date(payable.dueDate).toLocaleDateString('pt-BR')}</span>
                    </p>
                  </div>
                  <div className="text-right px-6 border-r border-l">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Saldo</p>
                    <p className="text-xl font-bold text-red-600">{formatCurrency(payable.balanceDue || payable.amount)}</p>
                  </div>
                  <Button onClick={() => handleOpenPayment(payable)} className="bg-green-600 hover:bg-green-700 h-10 px-6">Pagar Agora</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* --- SEÇÃO 3: CONTAS RECORRENTES (FIXAS) --- */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-purple-100 rounded-lg text-purple-600"><Calendar className="w-5 h-5" /></div>
            <h2 className="text-lg font-bold">Custos Fixos / Recorrentes</h2>
          </div>
          <Button size="sm" variant="outline" onClick={handleGenerateMonth} className="text-purple-700 borderColor-purple-200 hover:bg-purple-50">Gerar Cobranças do Mês</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recurringBills.length === 0 ? (
            <Card className="col-span-full border-dashed"><CardContent className="py-6 text-center text-muted-foreground">Nenhuma conta recorrente cadastrada.</CardContent></Card>
          ) : (
            recurringBills.map((bill) => (
              <Card key={bill.id} className={!bill.active ? 'opacity-60 bg-gray-50' : ''}>
                <CardContent className="p-4 flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold">{bill.name}</span>
                      <Badge variant="secondary" className="text-[10px]">Dia {bill.dueDay}</Badge>
                      {!bill.active && <Badge variant="destructive" className="text-[10px]">Inativo</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{bill.description || 'Sem descrição'}</p>
                    {bill.lastGeneratedAt && <p className="text-[10px] text-green-600">Última geração: {new Date(bill.lastGeneratedAt).toLocaleDateString('pt-BR')}</p>}
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-lg font-bold">{formatCurrency(bill.amount)}</p>
                    </div>
                    <div className="flex flex-col space-y-1">
                      <Button size="icon" variant="ghost" onClick={() => { setSelectedRecurring(bill); setRecurringData({ ...bill, amount: bill.amount.toString(), dueDay: bill.dueDay.toString(), supplierId: bill.supplierId || '', categoryId: bill.categoryId || '', description: bill.description || '' }); setShowRecurringModal(true); }}><Edit2 className="w-3 h-3" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteRecurring(bill.id)} className="text-red-500"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      {/* --- MODAIS --- */}

      {/* 1. Modal Pagamento Fatura (AccountPayable) */}
      {showPaymentModal && selectedPayable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader><CardTitle>Liquidar Fatura</CardTitle><CardDescription>Pagar R$ {paymentData.amountPaid} para {selectedPayable.supplier?.name}</CardDescription></CardHeader>
            <CardContent><form onSubmit={handlePayBill} className="space-y-4">
              <label className="text-sm font-medium">Conta Bancária de Saída *</label>
              <select value={paymentData.paymentAccountId} onChange={e => setPaymentData({ ...paymentData, paymentAccountId: e.target.value })} className="w-full p-2 border rounded" required>
                <option value="">Selecione...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance)})</option>)}
              </select>
              <Input type="number" step="0.01" value={paymentData.amountPaid} onChange={e => setPaymentData({ ...paymentData, amountPaid: e.target.value })} placeholder="Valor Pago" required />
              <Input value={paymentData.notes} onChange={e => setPaymentData({ ...paymentData, notes: e.target.value })} placeholder="Observações" />
              <div className="flex justify-end space-x-2 pt-4"><Button type="button" variant="outline" onClick={() => setShowPaymentModal(false)}>Cancelar</Button><Button type="submit" className="bg-green-600">Confirmar</Button></div>
            </form></CardContent>
          </Card>
        </div>
      )}

      {/* 2. Modal Novo Recibo Manual */}
      {showReceiptModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader><CardTitle>Novo Recibo de Material</CardTitle><CardDescription>Registrar débito acumulado com fornecedor (sem nota imediata)</CardDescription></CardHeader>
            <CardContent><form onSubmit={handleSaveReceipt} className="space-y-4">
              <label className="text-sm font-medium">Fornecedor *</label>
              <select value={receiptData.supplierId} onChange={e => setReceiptData({ ...receiptData, supplierId: e.target.value })} className="w-full p-2 border rounded" required>
                <option value="">Selecione...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Input type="number" step="0.01" value={receiptData.totalAmount} onChange={e => setReceiptData({ ...receiptData, totalAmount: e.target.value })} placeholder="Valor (R$)" required />
              <Input type="date" value={receiptData.issueDate} onChange={e => setReceiptData({ ...receiptData, issueDate: e.target.value })} required />
              <Input value={receiptData.notes} onChange={e => setReceiptData({ ...receiptData, notes: e.target.value })} placeholder="Ex: Retirada 20m vinil" />
              <div className="flex justify-end space-x-2 pt-4"><Button type="button" variant="outline" onClick={() => setShowReceiptModal(false)}>Cancelar</Button><Button type="submit" className="bg-orange-600 text-white">Salvar Recibo</Button></div>
            </form></CardContent>
          </Card>
        </div>
      )}

      {/* 3. Modal Fechar Fatura (Transformar Recibos em AccountPayable) */}
      {showCloseInvoiceModal && selectedSummary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg shadow-2xl">
            <CardHeader><CardTitle>Fechar Fatura: {selectedSummary.supplierName}</CardTitle><CardDescription>Consolidando {selectedSummary.count} recibos (Total: {formatCurrency(selectedSummary.total)})</CardDescription></CardHeader>
            <CardContent><form onSubmit={handleCloseInvoice} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-xs font-bold uppercase">Data de Vencimento</label><Input type="date" value={closeData.dueDate} onChange={e => setCloseData({ ...closeData, dueDate: e.target.value })} required /></div>
                <div className="space-y-2"><label className="text-xs font-bold uppercase">Conta de Estoque (Débito)</label>
                  <select value={closeData.stockAccountId} onChange={e => setCloseData({ ...closeData, stockAccountId: e.target.value })} className="w-full p-2 border rounded text-sm" required>
                    <option value="">Selecione no plano de contas...</option>
                    {chartOfAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2"><label className="text-xs font-bold uppercase">Conta do Fornecedor (Crédito)</label>
                <select value={closeData.supplierAccountId} onChange={e => setCloseData({ ...closeData, supplierAccountId: e.target.value })} className="w-full p-2 border rounded text-sm" required>
                  <option value="">Selecione no plano de contas...</option>
                  {chartOfAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
                </select>
              </div>
              <Input value={closeData.notes} onChange={e => setCloseData({ ...closeData, notes: e.target.value })} placeholder="Notas adicionais" />
              <div className="flex justify-end space-x-2 pt-4 border-t"><Button type="button" variant="outline" onClick={() => setShowCloseInvoiceModal(false)}>Cancelar</Button><Button type="submit" className="bg-orange-600 text-white">Gerar Conta a Pagar</Button></div>
            </form></CardContent>
          </Card>
        </div>
      )}

      {/* 4. Modal Conta Recorrente */}
      {showRecurringModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader><CardTitle>{selectedRecurring ? 'Editar' : 'Nova'} Conta Recorrente</CardTitle></CardHeader>
            <CardContent><form onSubmit={handleSaveRecurring} className="space-y-4">
              <Input value={recurringData.name} onChange={e => setRecurringData({ ...recurringData, name: e.target.value })} placeholder="Nome (Ex: Aluguel)" required />
              <div className="grid grid-cols-2 gap-4">
                <Input type="number" step="0.01" value={recurringData.amount} onChange={e => setRecurringData({ ...recurringData, amount: e.target.value })} placeholder="Valor R$" required />
                <Input type="number" min="1" max="31" value={recurringData.dueDay} onChange={e => setRecurringData({ ...recurringData, dueDay: e.target.value })} placeholder="Dia Venc. (1-31)" required />
              </div>
              <select value={recurringData.supplierId} onChange={e => setRecurringData({ ...recurringData, supplierId: e.target.value })} className="w-full p-2 border rounded">
                <option value="">Selecione Credor (opcional)</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={recurringData.categoryId} onChange={e => setRecurringData({ ...recurringData, categoryId: e.target.value })} className="w-full p-2 border rounded">
                <option value="">Selecione Categoria (opcional)</option>
                {chartOfAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
              </select>
              <Input value={recurringData.description} onChange={e => setRecurringData({ ...recurringData, description: e.target.value })} placeholder="Notas Extras" />
              <div className="flex items-center space-x-2">
                <input type="checkbox" checked={recurringData.active} onChange={e => setRecurringData({ ...recurringData, active: e.target.checked })} id="recurring-active" />
                <label htmlFor="recurring-active">Conta Ativa</label>
              </div>
              <div className="flex justify-end space-x-2 pt-4 border-t"><Button type="button" variant="outline" onClick={() => { setShowRecurringModal(false); setSelectedRecurring(null); }}>Cancelar</Button><Button type="submit" className="bg-purple-600 text-white">Salvar</Button></div>
            </form></CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

