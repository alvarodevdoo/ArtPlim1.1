import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import {
  CheckCircle, AlertTriangle, Clock, Plus, Calculator,
  Trash2, Edit2, Calendar, FileText, Search, RefreshCw
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface Supplier {
  id: string;
  name: string;
  document: string | null;
}

interface AccountPayable {
  id: string;
  amount: number;
  balanceDue?: number;
  dueDate: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  supplier: { id: string; name: string };
  supplierAccountId: string | null;
  _count: { receipts: number };
  notes?: string | null;
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

interface PayableStats {
  overdue: { total: number; count: number };
  upcoming: { total: number; count: number };
  paidThisMonth: { total: number; count: number };
  pendingReceipts: number;
}

type ActiveTab = 'payables' | 'receipts' | 'recurring' | 'history';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDueDateMidnight(dueDate: string) {
  // Datas da API vêm como ISO string. Parsear como data local (sem hora) evita
  // que diferenças de timezone marquem erroneamente o dia como vencido.
  const [year, month, day] = dueDate.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
}

function isOverdue(dueDate: string) {
  return parseDueDateMidnight(dueDate) < todayMidnight();
}

function formatDueDate(dueDate: string) {
  const due = parseDueDateMidnight(dueDate);
  const today = todayMidnight();
  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const label = due.toLocaleDateString('pt-BR');

  if (diffDays < 0) {
    const abs = Math.abs(diffDays);
    return { label, note: `Venceu há ${abs} dia${abs !== 1 ? 's' : ''}`, overdue: true };
  }
  if (diffDays === 0) return { label, note: 'Vence hoje', overdue: false };
  if (diffDays <= 7) return { label, note: `Vence em ${diffDays} dia${diffDays !== 1 ? 's' : ''}`, overdue: false };
  return { label, note: '', overdue: false };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ContasAPagar() {
  const [stats, setStats] = useState<PayableStats | null>(null);
  const [payables, setPayables] = useState<AccountPayable[]>([]);
  const [summaries, setSummaries] = useState<ReceiptSummary[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [activeTab, setActiveTab] = useState<ActiveTab>('payables');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal: pagar fatura
  const [paymentModal, setPaymentModal] = useState<AccountPayable | null>(null);
  const [paymentData, setPaymentData] = useState({ paymentAccountId: '', amountPaid: '', notes: '' });

  // Modal: fechar fatura (recibos → conta a pagar)
  const [closeModal, setCloseModal] = useState<ReceiptSummary | null>(null);
  const [closeData, setCloseData] = useState({
    dueDate: '',
    notes: ''
  });

  // Modal: novo recibo
  const [receiptModal, setReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState({
    supplierId: '',
    totalAmount: '',
    issueDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Modal: nova despesa direta
  const [directModal, setDirectModal] = useState(false);
  const [directData, setDirectData] = useState({
    supplierId: '',
    amount: '',
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    notes: ''
  });

  // Modal: conta recorrente
  const [recurringModal, setRecurringModal] = useState(false);
  const [selectedRecurring, setSelectedRecurring] = useState<RecurringBill | null>(null);
  const [recurringData, setRecurringData] = useState({
    name: '', amount: '', dueDay: '10', supplierId: '', description: '', active: true
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [payablesRes, summariesRes, recurringRes, accountsRes, suppliersRes, statsRes] = await Promise.all([
        api.get('/api/finance/payables'),
        api.get('/api/insumos/receipts/summary'),
        api.get('/api/finance/recurring-bills'),
        api.get('/api/finance/accounts'),
        api.get('/api/profiles?isSupplier=true'),
        api.get('/api/finance/payables/stats')
      ]);

      setPayables(payablesRes.data.data);
      setSummaries(summariesRes.data.data);
      setRecurringBills(recurringRes.data.data);
      setAccounts(accountsRes.data.data.filter((a: BankAccount) =>
        ['CHECKING', 'CASH', 'SAVINGS'].includes(a.type)
      ));
      setSuppliers(suppliersRes.data.data);
      setStats(statsRes.data.data);
    } catch {
      toast.error('Erro ao carregar dados financeiros');
    } finally {
      setLoading(false);
    }
  };

  // ── Filtros ────────────────────────────────────────────────────────────────

  const pendingPayables = useMemo(() =>
    payables.filter(p => p.status === 'PENDING'), [payables]);

  const overduePayables = useMemo(() =>
    pendingPayables.filter(p => isOverdue(p.dueDate)), [pendingPayables]);

  const upcomingPayables = useMemo(() =>
    pendingPayables.filter(p => !isOverdue(p.dueDate)), [pendingPayables]);

  const historyPayables = useMemo(() =>
    payables.filter(p => p.status === 'PAID' || p.status === 'CANCELLED'), [payables]);

  const filteredUpcoming = useMemo(() =>
    upcomingPayables.filter(p =>
      p.supplier?.name?.toLowerCase().includes(search.toLowerCase())
    ), [upcomingPayables, search]);

  const filteredOverdue = useMemo(() =>
    overduePayables.filter(p =>
      p.supplier?.name?.toLowerCase().includes(search.toLowerCase())
    ), [overduePayables, search]);

  const filteredHistory = useMemo(() =>
    historyPayables.filter(p =>
      p.supplier?.name?.toLowerCase().includes(search.toLowerCase())
    ), [historyPayables, search]);

  // ── Handlers: Pagamento ────────────────────────────────────────────────────

  const openPaymentModal = (payable: AccountPayable) => {
    setPaymentModal(payable);
    setPaymentData({
      paymentAccountId: accounts.length === 1 ? accounts[0].id : '',
      amountPaid: String(payable.balanceDue ?? payable.amount),
      notes: ''
    });
  };

  const handlePayBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal) return;
    try {
      await api.post(`/api/finance/payables/${paymentModal.id}/pay`, {
        paymentAccountId: paymentData.paymentAccountId,
        amountPaid: parseFloat(paymentData.amountPaid),
        notes: paymentData.notes || undefined
      });
      toast.success('Pagamento registrado com sucesso!');
      setPaymentModal(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao registrar pagamento');
    }
  };

  // ── Handlers: Fechar Fatura ────────────────────────────────────────────────

  const openCloseModal = (summary: ReceiptSummary) => {
    setCloseModal(summary);
    setCloseData({
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      notes: `Fechamento: ${summary.count} recibo${summary.count !== 1 ? 's' : ''}`
    });
  };

  const handleCloseInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closeModal) return;
    try {
      await api.post('/api/insumos/receipts/close', {
        supplierId: closeModal.supplierId,
        receiptIds: closeModal.receiptIds,
        dueDate: closeData.dueDate,
        notes: closeData.notes || undefined
        // stockAccountId e supplierAccountId são auto-resolvidos no backend
      });
      toast.success('Fatura gerada em Contas a Pagar!');
      setCloseModal(null);
      setActiveTab('payables');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao fechar fatura');
    }
  };

  // ── Handlers: Novo Recibo ──────────────────────────────────────────────────

  const handleSaveReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/insumos/receipts', {
        supplierId: receiptData.supplierId,
        totalAmount: parseFloat(receiptData.totalAmount),
        issueDate: receiptData.issueDate,
        notes: receiptData.notes || undefined
      });
      toast.success('Recibo registrado!');
      setReceiptModal(false);
      setReceiptData({ supplierId: '', totalAmount: '', issueDate: new Date().toISOString().split('T')[0], notes: '' });
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao salvar recibo');
    }
  };

  // ── Handlers: Despesa Direta ───────────────────────────────────────────────

  const handleSaveDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/finance/payables/direct', {
        supplierId: directData.supplierId || undefined,
        amount: parseFloat(directData.amount),
        dueDate: directData.dueDate,
        notes: directData.notes || undefined
      });
      toast.success('Despesa lançada em Contas a Pagar!');
      setDirectModal(false);
      setDirectData({ supplierId: '', amount: '', dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], notes: '' });
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao lançar despesa');
    }
  };

  // ── Handlers: Recorrentes ──────────────────────────────────────────────────

  const handleSaveRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: recurringData.name,
      amount: parseFloat(recurringData.amount),
      dueDay: parseInt(recurringData.dueDay),
      supplierId: recurringData.supplierId || null,
      description: recurringData.description || null,
      active: recurringData.active
    };
    try {
      if (selectedRecurring) {
        await api.put(`/api/finance/recurring-bills/${selectedRecurring.id}`, payload);
      } else {
        await api.post('/api/finance/recurring-bills', payload);
      }
      toast.success('Conta recorrente salva!');
      setRecurringModal(false);
      setSelectedRecurring(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao salvar conta recorrente');
    }
  };

  const handleDeleteRecurring = async (id: string) => {
    if (!confirm('Excluir esta conta recorrente?')) return;
    try {
      await api.delete(`/api/finance/recurring-bills/${id}`);
      toast.success('Removida!');
      loadData();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const handleGenerateMonth = async () => {
    const date = new Date();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const monthLabel = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    if (!confirm(`Gerar cobranças de ${monthLabel}?`)) return;
    try {
      const res = await api.post('/api/finance/recurring-bills/generate-month', { year, month });
      const generated = res.data.data.generated ?? [];
      toast.success(generated.length > 0
        ? `${generated.length} cobrança${generated.length !== 1 ? 's' : ''} gerada${generated.length !== 1 ? 's' : ''}!`
        : 'Cobranças já geradas para este mês.'
      );
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao gerar cobranças');
    }
  };

  // ── Sub-componentes ────────────────────────────────────────────────────────

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'PENDING': return <Badge variant="outline" className="text-yellow-600 bg-yellow-50 border-yellow-200"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      case 'PAID':    return <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Pago</Badge>;
      default:        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const PayableRow = ({ payable, highlight }: { payable: AccountPayable; highlight?: boolean }) => {
    const { label, note, overdue } = formatDueDate(payable.dueDate);
    const amount = payable.balanceDue ?? payable.amount;
    return (
      <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-lg border transition-colors ${highlight ? 'bg-red-50 border-red-200 hover:bg-red-100' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate">{payable.supplier?.name}</span>
            <StatusBadge status={payable.status} />
            {payable._count?.receipts > 0 && (
              <Badge variant="secondary" className="text-xs">{payable._count.receipts} recibo{payable._count.receipts !== 1 ? 's' : ''}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span className={overdue ? 'text-red-600 font-medium' : ''}>{label}</span>
            {note && <span className={`text-xs ${overdue ? 'text-red-500' : 'text-amber-600'}`}>· {note}</span>}
          </div>
          {payable.notes && <p className="text-xs text-muted-foreground mt-1 truncate">{payable.notes}</p>}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className={`text-lg font-bold ${overdue ? 'text-red-600' : 'text-gray-800'}`}>{formatCurrency(amount)}</p>
          </div>
          <Button size="sm" onClick={() => openPaymentModal(payable)} className="bg-green-600 hover:bg-green-700 shrink-0">
            Pagar
          </Button>
        </div>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <RefreshCw className="w-6 h-6 animate-spin" />
        <span>Carregando painel financeiro...</span>
      </div>
    );
  }

  const tabs: { key: ActiveTab; label: string; count?: number }[] = [
    { key: 'payables', label: 'A Pagar', count: pendingPayables.length },
    { key: 'receipts', label: 'Recibos', count: summaries.length },
    { key: 'recurring', label: 'Recorrentes', count: recurringBills.filter(b => b.active).length },
    { key: 'history', label: 'Histórico', count: historyPayables.length }
  ];

  return (
    <div className="space-y-6">

      {/* ── Cabeçalho ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas a Pagar</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Controle de faturas, recibos de compra e custos fixos.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setReceiptModal(true)} size="sm">
            <FileText className="w-4 h-4 mr-1.5" />Novo Recibo
          </Button>
          <Button onClick={() => setDirectModal(true)} size="sm">
            <Plus className="w-4 h-4 mr-1.5" />Nova Despesa
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className={stats.overdue.count > 0 ? 'border-red-200 bg-red-50' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className={`w-4 h-4 ${stats.overdue.count > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vencidas</span>
              </div>
              <p className={`text-xl font-bold ${stats.overdue.count > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {formatCurrency(stats.overdue.total)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{stats.overdue.count} fatura{stats.overdue.count !== 1 ? 's' : ''}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">A Vencer</span>
              </div>
              <p className="text-xl font-bold text-gray-800">{formatCurrency(stats.upcoming.total)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stats.upcoming.count} fatura{stats.upcoming.count !== 1 ? 's' : ''}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pago este mês</span>
              </div>
              <p className="text-xl font-bold text-green-600">{formatCurrency(stats.paidThisMonth.total)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stats.paidThisMonth.count} fatura{stats.paidThisMonth.count !== 1 ? 's' : ''}</p>
            </CardContent>
          </Card>

          <Card className={stats.pendingReceipts > 0 ? 'border-orange-200 bg-orange-50' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calculator className={`w-4 h-4 ${stats.pendingReceipts > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recibos Abertos</span>
              </div>
              <p className={`text-xl font-bold ${stats.pendingReceipts > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                {stats.pendingReceipts}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">aguardando faturamento</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────────────────────────── */}
      <div className="border-b flex gap-0">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: A Pagar ──────────────────────────────────────────────────────── */}
      {activeTab === 'payables' && (
        <div className="space-y-5">
          {pendingPayables.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-9"
                placeholder="Buscar por fornecedor..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          )}

          {/* Vencidas */}
          {filteredOverdue.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h2 className="font-semibold text-red-600">Vencidas ({filteredOverdue.length})</h2>
              </div>
              {filteredOverdue.map(p => <PayableRow key={p.id} payable={p} highlight />)}
            </section>
          )}

          {/* A vencer */}
          {filteredUpcoming.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <h2 className="font-semibold text-gray-700">A Vencer ({filteredUpcoming.length})</h2>
              </div>
              {filteredUpcoming.map(p => <PayableRow key={p.id} payable={p} />)}
            </section>
          )}

          {pendingPayables.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-muted-foreground">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
                <p className="font-medium">Tudo em dia!</p>
                <p className="text-sm mt-1">Nenhuma fatura pendente no momento.</p>
              </CardContent>
            </Card>
          )}

          {pendingPayables.length > 0 && filteredOverdue.length === 0 && filteredUpcoming.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                Nenhum resultado para "{search}"
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Tab: Recibos ──────────────────────────────────────────────────────── */}
      {activeTab === 'receipts' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Recibos de compra agrupados por fornecedor. Feche a fatura para gerar uma conta a pagar.
            </p>
            <Button variant="outline" size="sm" onClick={() => setReceiptModal(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />Novo Recibo
            </Button>
          </div>

          {summaries.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="font-medium">Nenhum recibo pendente</p>
                <p className="text-sm mt-1">Registre um novo recibo de compra ao receber materiais.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {summaries.map(s => (
                <Card key={s.supplierId} className="hover:shadow-md transition-shadow border-orange-100">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold">{s.supplierName}</p>
                        <p className="text-xs text-muted-foreground">{s.supplierDocument || 'Sem CNPJ/CPF'}</p>
                      </div>
                      <Badge className="bg-orange-100 text-orange-700 border-none text-xs">
                        {s.count} recibo{s.count !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-xs text-muted-foreground">Total acumulado</p>
                        <p className="text-xl font-bold text-orange-600">{formatCurrency(s.total)}</p>
                      </div>
                      <Button size="sm" onClick={() => openCloseModal(s)} className="bg-orange-600 hover:bg-orange-700 text-white">
                        Gerar Fatura
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Recorrentes ──────────────────────────────────────────────────── */}
      {activeTab === 'recurring' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Despesas fixas mensais. Use "Gerar Mês" para criar as cobranças do mês atual.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleGenerateMonth} className="text-purple-700 hover:bg-purple-50">
                <Calendar className="w-3.5 h-3.5 mr-1.5" />Gerar Mês
              </Button>
              <Button size="sm" onClick={() => { setSelectedRecurring(null); setRecurringData({ name: '', amount: '', dueDay: '10', supplierId: '', description: '', active: true }); setRecurringModal(true); }}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />Nova
              </Button>
            </div>
          </div>

          {recurringBills.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-muted-foreground">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="font-medium">Nenhuma despesa recorrente</p>
                <p className="text-sm mt-1">Cadastre aluguel, internet, energia e outros custos fixos.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recurringBills.map(bill => (
                <Card key={bill.id} className={`${!bill.active ? 'opacity-50' : ''}`}>
                  <CardContent className="p-4 flex justify-between items-center">
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{bill.name}</span>
                        <Badge variant="secondary" className="text-xs">Dia {bill.dueDay}</Badge>
                        {!bill.active && <Badge variant="destructive" className="text-xs">Inativo</Badge>}
                      </div>
                      {bill.description && <p className="text-xs text-muted-foreground truncate">{bill.description}</p>}
                      {bill.lastGeneratedAt && (
                        <p className="text-xs text-green-600">
                          Gerado em {new Date(bill.lastGeneratedAt).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <p className="text-lg font-bold whitespace-nowrap">{formatCurrency(bill.amount)}</p>
                      <div className="flex flex-col gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                          setSelectedRecurring(bill);
                          setRecurringData({ name: bill.name, amount: String(bill.amount), dueDay: String(bill.dueDay), supplierId: bill.supplierId || '', description: bill.description || '', active: bill.active });
                          setRecurringModal(true);
                        }}>
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => handleDeleteRecurring(bill.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Histórico ────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {historyPayables.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input className="pl-9" placeholder="Buscar por fornecedor..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          )}

          {filteredHistory.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-muted-foreground">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="font-medium">Sem histórico ainda</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredHistory.map(payable => {
                const { label } = formatDueDate(payable.dueDate);
                const amount = payable.balanceDue ?? payable.amount;
                return (
                  <div key={payable.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-4 rounded-lg border bg-white">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{payable.supplier?.name}</span>
                        <StatusBadge status={payable.status} />
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">Vencimento: {label}</p>
                    </div>
                    <p className="text-base font-semibold text-gray-500">{formatCurrency(amount)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAIS
      ══════════════════════════════════════════════════════════════════════════ */}

      {/* Modal: Pagar Fatura */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader>
              <CardTitle>Registrar Pagamento</CardTitle>
              <CardDescription>
                {paymentModal.supplier?.name} · {formatCurrency(paymentModal.balanceDue ?? paymentModal.amount)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePayBill} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Conta bancária de débito *</label>
                  <select
                    value={paymentData.paymentAccountId}
                    onChange={e => setPaymentData({ ...paymentData, paymentAccountId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                    required
                  >
                    <option value="">Selecione a conta...</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} · {formatCurrency(a.balance)}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Valor pago (R$) *</label>
                  <Input
                    type="number" step="0.01" min="0.01"
                    value={paymentData.amountPaid}
                    onChange={e => setPaymentData({ ...paymentData, amountPaid: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Observações</label>
                  <Input
                    value={paymentData.notes}
                    onChange={e => setPaymentData({ ...paymentData, notes: e.target.value })}
                    placeholder="Ex: Pago via PIX, chave CNPJ"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setPaymentModal(null)}>Cancelar</Button>
                  <Button type="submit" className="bg-green-600 hover:bg-green-700">Confirmar Pagamento</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Fechar Fatura (recibos → conta a pagar) */}
      {closeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader>
              <CardTitle>Gerar Conta a Pagar</CardTitle>
              <CardDescription>
                {closeModal.supplierName} · {closeModal.count} recibo{closeModal.count !== 1 ? 's' : ''} · {formatCurrency(closeModal.total)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCloseInvoice} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Data de vencimento *</label>
                  <Input
                    type="date"
                    value={closeData.dueDate}
                    onChange={e => setCloseData({ ...closeData, dueDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Observações</label>
                  <Input
                    value={closeData.notes}
                    onChange={e => setCloseData({ ...closeData, notes: e.target.value })}
                    placeholder="Referência, número da nota fiscal, etc."
                  />
                </div>
                <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                  Os lançamentos contábeis (Estoque / Fornecedores a Pagar) são gerados automaticamente.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setCloseModal(null)}>Cancelar</Button>
                  <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white">Gerar Fatura</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Novo Recibo de Material */}
      {receiptModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader>
              <CardTitle>Novo Recibo de Material</CardTitle>
              <CardDescription>Registre uma entrada de insumos ou materiais do fornecedor.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveReceipt} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Fornecedor *</label>
                  <select
                    value={receiptData.supplierId}
                    onChange={e => setReceiptData({ ...receiptData, supplierId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                    required
                  >
                    <option value="">Selecione...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Valor (R$) *</label>
                    <Input type="number" step="0.01" min="0.01" value={receiptData.totalAmount} onChange={e => setReceiptData({ ...receiptData, totalAmount: e.target.value })} required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Data *</label>
                    <Input type="date" value={receiptData.issueDate} onChange={e => setReceiptData({ ...receiptData, issueDate: e.target.value })} required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Observações</label>
                  <Input value={receiptData.notes} onChange={e => setReceiptData({ ...receiptData, notes: e.target.value })} placeholder="Ex: 20m vinil, NF 1234" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setReceiptModal(false)}>Cancelar</Button>
                  <Button type="submit" className="bg-primary">Salvar Recibo</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Nova Despesa Direta */}
      {directModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader>
              <CardTitle>Nova Despesa</CardTitle>
              <CardDescription>Lance uma conta a pagar diretamente (sem recibo de material).</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveDirect} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Credor / Fornecedor</label>
                  <select
                    value={directData.supplierId}
                    onChange={e => setDirectData({ ...directData, supplierId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                  >
                    <option value="">Nenhum (avulso)</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Valor (R$) *</label>
                    <Input type="number" step="0.01" min="0.01" value={directData.amount} onChange={e => setDirectData({ ...directData, amount: e.target.value })} required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Vencimento *</label>
                    <Input type="date" value={directData.dueDate} onChange={e => setDirectData({ ...directData, dueDate: e.target.value })} required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Observações</label>
                  <Input value={directData.notes} onChange={e => setDirectData({ ...directData, notes: e.target.value })} placeholder="Ex: Aluguel março, conta de luz" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDirectModal(false)}>Cancelar</Button>
                  <Button type="submit">Lançar Despesa</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Conta Recorrente */}
      {recurringModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader>
              <CardTitle>{selectedRecurring ? 'Editar' : 'Nova'} Conta Recorrente</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveRecurring} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Nome *</label>
                  <Input value={recurringData.name} onChange={e => setRecurringData({ ...recurringData, name: e.target.value })} placeholder="Ex: Aluguel, Internet, Energia" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Valor (R$) *</label>
                    <Input type="number" step="0.01" min="0.01" value={recurringData.amount} onChange={e => setRecurringData({ ...recurringData, amount: e.target.value })} required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Dia do venc. *</label>
                    <Input type="number" min="1" max="31" value={recurringData.dueDay} onChange={e => setRecurringData({ ...recurringData, dueDay: e.target.value })} required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Credor (opcional)</label>
                  <select value={recurringData.supplierId} onChange={e => setRecurringData({ ...recurringData, supplierId: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm bg-background">
                    <option value="">Nenhum</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Notas</label>
                  <Input value={recurringData.description} onChange={e => setRecurringData({ ...recurringData, description: e.target.value })} placeholder="Observações extras" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="rec-active" checked={recurringData.active} onChange={e => setRecurringData({ ...recurringData, active: e.target.checked })} />
                  <label htmlFor="rec-active" className="text-sm">Conta ativa</label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => { setRecurringModal(false); setSelectedRecurring(null); }}>Cancelar</Button>
                  <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white">Salvar</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
