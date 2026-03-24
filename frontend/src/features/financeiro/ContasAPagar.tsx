import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import { CheckCircle, AlertCircle, Clock, DollarSign } from 'lucide-react';

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
}

export function ContasAPagar() {
  const [payables, setPayables] = useState<AccountPayable[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayable, setSelectedPayable] = useState<AccountPayable | null>(null);

  const [paymentData, setPaymentData] = useState({
    paymentAccountId: '',
    amountPaid: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [payablesRes, accountsRes] = await Promise.all([
        api.get('/api/finance/payables'),
        api.get('/api/finance/accounts')
      ]);
      setPayables(payablesRes.data.data);
      // Pega contas que podem realizar pagamentos (ativo corrente ou dinheiro)
      setAccounts(accountsRes.data.data.filter((a: any) => a.type === 'CHECKING' || a.type === 'CASH' || a.type === 'SAVINGS'));
    } catch (error) {
      toast.error('Erro ao carregar contas a pagar');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPayment = (payable: AccountPayable) => {
    setSelectedPayable(payable);
    setPaymentData({
      paymentAccountId: '',
      amountPaid: payable.balanceDue.toString(),
      notes: ''
    });
    setShowPaymentModal(true);
  };

  const handlePayBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayable) return;

    try {
      await api.post(`/api/finance/payables/${selectedPayable.id}/pay`, {
        paymentAccountId: paymentData.paymentAccountId,
        supplierAccountId: null, // Resolvido no backend caso não fornecido
        amountPaid: parseFloat(paymentData.amountPaid),
        notes: paymentData.notes
      });
      toast.success('Fatura paga com sucesso!');
      setShowPaymentModal(false);
      setSelectedPayable(null);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao realizar pagamento');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="flex items-center text-yellow-600 bg-yellow-100 px-2 py-1 rounded text-xs font-semibold"><Clock className="w-3 h-3 mr-1" /> Pendente</span>;
      case 'PAID':
        return <span className="flex items-center text-green-600 bg-green-100 px-2 py-1 rounded text-xs font-semibold"><CheckCircle className="w-3 h-3 mr-1" /> Pago</span>;
      case 'PARTIAL':
        return <span className="flex items-center text-blue-600 bg-blue-100 px-2 py-1 rounded text-xs font-semibold"><Clock className="w-3 h-3 mr-1" /> Parcial</span>;
      default:
        return <span className="flex items-center text-gray-600 bg-gray-100 px-2 py-1 rounded text-xs font-semibold"><AlertCircle className="w-3 h-3 mr-1" /> {status}</span>;
    }
  };

  if (loading) return <div>Carregando faturas...</div>;

  return (
    <div className="space-y-6 mt-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Contas a Pagar (Fornecedores)</h2>
          <p className="text-sm text-muted-foreground">Faturas consolidadas do módulo de compras</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {payables.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-gray-50 text-muted-foreground">
            Nenhuma fatura de fornecedor pendente no momento.
          </div>
        ) : (
          payables.map((payable) => (
            <Card key={payable.id} className="shadow-sm">
              <CardContent className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-lg">{payable.supplier?.name || 'Fornecedor Desconhecido'}</span>
                    {getStatusBadge(payable.status)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Vencimento: <span className={new Date(payable.dueDate) < new Date() && payable.status !== 'PAID' ? 'text-red-500 font-bold' : ''}>{new Date(payable.dueDate).toLocaleDateString('pt-BR')}</span>
                    {' • '}{payable._count.receipts} recibo(s) atrelado(s)
                  </p>
                </div>
                
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Valor em Aberto</p>
                  <p className="text-xl font-bold text-red-600">{formatCurrency(payable.balanceDue || payable.amount)}</p>
                </div>

                {payable.status !== 'PAID' && (
                  <div className="pl-4 border-l">
                    <Button onClick={() => handleOpenPayment(payable)} className="bg-green-600 hover:bg-green-700">
                      <DollarSign className="w-4 h-4 mr-2" /> Pagar Fatura
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {showPaymentModal && selectedPayable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Liquidar Fatura</CardTitle>
              <CardDescription>Pagar R$ {selectedPayable.balanceDue} para {selectedPayable.supplier?.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePayBill} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Conta de Saída (Conta Bancária) *</label>
                  <select
                    value={paymentData.paymentAccountId}
                    onChange={e => setPaymentData({ ...paymentData, paymentAccountId: e.target.value })}
                    className="w-full h-10 px-3 py-2 border rounded-md" required
                  >
                    <option value="">Selecione a conta de onde o dinheiro sairá...</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance)})</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Valor Pago *</label>
                  <Input type="number" step="0.01" value={paymentData.amountPaid} onChange={e => setPaymentData({ ...paymentData, amountPaid: e.target.value })} required />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Observações</label>
                  <Input value={paymentData.notes} onChange={e => setPaymentData({ ...paymentData, notes: e.target.value })} />
                </div>

                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setShowPaymentModal(false)}>Cancelar</Button>
                  <Button type="submit" className="bg-green-600 hover:bg-green-700">Confirmar Pagamento</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
