import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import { CheckCircle, Clock, AlertCircle, Plus, X } from 'lucide-react';

interface Receivable {
  id: string;
  amount: number;
  dueDate: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  notes: string | null;
  customer: { id: string; name: string; document: string | null };
  order: { id: string; orderNumber: string; total: number } | null;
  _count: { transactions: number };
}

interface Account {
  id: string;
  name: string;
  type: string;
}

interface Customer {
  id: string;
  name: string;
}

export function ContasAReceber() {
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    customerId: '',
    amount: '',
    dueDate: new Date().toISOString().split('T')[0],
    receivableAccountId: '',
    revenueAccountId: '',
    notes: ''
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recRes, accRes, profRes] = await Promise.all([
        api.get('/api/finance/receivables'),
        api.get('/api/finance/accounts'),
        api.get('/api/profiles')
      ]);
      setReceivables(recRes.data.data);
      setAccounts(accRes.data.data);
      setCustomers(profRes.data.data.filter((p: any) => p.isCustomer || p.type === 'CUSTOMER'));
    } catch {
      toast.error('Erro ao carregar contas a receber');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/finance/receivables', {
        customerId: form.customerId,
        amount: parseFloat(form.amount),
        dueDate: form.dueDate,
        receivableAccountId: form.receivableAccountId,
        revenueAccountId: form.revenueAccountId,
        notes: form.notes || undefined
      });
      toast.success('Conta a Receber criada com sucesso!');
      setShowForm(false);
      setForm({ customerId: '', amount: '', dueDate: new Date().toISOString().split('T')[0], receivableAccountId: '', revenueAccountId: '', notes: '' });
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao criar conta a receber');
    }
  };

  const getStatusBadge = (status: string, dueDate: string) => {
    const isOverdue = status === 'PENDING' && new Date(dueDate) < new Date();
    if (isOverdue) return <span className="flex items-center gap-1 text-red-600 bg-red-100 px-2 py-0.5 rounded text-xs font-semibold"><AlertCircle className="w-3 h-3" /> Vencida</span>;
    if (status === 'PAID') return <span className="flex items-center gap-1 text-green-600 bg-green-100 px-2 py-0.5 rounded text-xs font-semibold"><CheckCircle className="w-3 h-3" /> Recebida</span>;
    return <span className="flex items-center gap-1 text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded text-xs font-semibold"><Clock className="w-3 h-3" /> Pendente</span>;
  };

  const totalPending = receivables.filter(r => r.status === 'PENDING').reduce((s, r) => s + r.amount, 0);
  const totalReceived = receivables.filter(r => r.status === 'PAID').reduce((s, r) => s + r.amount, 0);

  if (loading) return <div className="mt-6 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6 mt-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase">Em Aberto</p>
            <p className="text-xl font-bold text-yellow-600">{formatCurrency(totalPending)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase">Recebido</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(totalReceived)}</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nova Conta a Receber
        </Button>
      </div>

      <div className="space-y-3">
        {receivables.length === 0 ? (
          <div className="text-center py-12 border rounded-lg text-muted-foreground">Nenhuma conta a receber.</div>
        ) : receivables.map(r => (
          <Card key={r.id} className="shadow-sm">
            <CardContent className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">{r.customer.name}</span>
                  {getStatusBadge(r.status, r.dueDate)}
                  {r.order && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Pedido #{r.order.orderNumber}</span>}
                </div>
                <p className="text-sm text-muted-foreground">
                  Vence em: <span className={new Date(r.dueDate) < new Date() && r.status === 'PENDING' ? 'text-red-500 font-semibold' : ''}>
                    {new Date(r.dueDate).toLocaleDateString('pt-BR')}
                  </span>
                  {r.notes && ` • ${r.notes}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Valor</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(r.amount)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Nova Conta a Receber (Partidas Dobradas)</CardTitle>
                <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
              </div>
              <CardDescription>Gera DEBIT (Ativo: A Receber) + INCOME (Receita de Vendas)</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cliente *</label>
                  <select value={form.customerId} onChange={e => setForm(p => ({ ...p, customerId: e.target.value }))} className="w-full h-10 px-3 border rounded-md" required>
                    <option value="">Selecione...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Valor (R$) *</label>
                    <Input type="number" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Vencimento *</label>
                    <Input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} required />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-blue-600">Conta de Ativo (Contas a Receber) *</label>
                  <select value={form.receivableAccountId} onChange={e => setForm(p => ({ ...p, receivableAccountId: e.target.value }))} className="w-full h-10 px-3 border border-blue-200 rounded-md" required>
                    <option value="">Selecione a conta de ativo do cliente...</option>
                    {accounts.filter(a => a.type === 'ASSET' || a.type === 'CHECKING').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <p className="text-xs text-muted-foreground">Receberá o DÉBITO (direito de receber ↑)</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-green-600">Conta de Receita (Vendas) *</label>
                  <select value={form.revenueAccountId} onChange={e => setForm(p => ({ ...p, revenueAccountId: e.target.value }))} className="w-full h-10 px-3 border border-green-200 rounded-md" required>
                    <option value="">Selecione a conta de receita...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <p className="text-xs text-muted-foreground">Receberá o INCOME (afeta o DRE)</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Observações</label>
                  <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                  <Button type="submit">Criar Conta a Receber</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
