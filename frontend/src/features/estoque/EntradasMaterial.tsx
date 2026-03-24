import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import { Plus, CheckSquare, Receipt, Truck } from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  document: string | null;
}

interface Account {
  id: string;
  name: string;
  type: string;
}

interface MaterialReceipt {
  id: string;
  supplierId: string;
  invoiceNumber: string | null;
  totalAmount: number;
  issueDate: string;
  status: string;
  supplier: { id: string; name: string; document: string | null };
}

export function EntradasMaterial() {
  const [receipts, setReceipts] = useState<MaterialReceipt[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedReceipts, setSelectedReceipts] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    supplierId: '',
    invoiceNumber: '',
    totalAmount: '',
    issueDate: new Date().toISOString().split('T')[0]
  });

  const [closeData, setCloseData] = useState({
    dueDate: new Date().toISOString().split('T')[0],
    stockAccountId: '',
    supplierAccountId: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [receiptsRes, accountsRes, profilesRes] = await Promise.all([
        api.get('/api/insumos/receipts'),
        api.get('/api/finance/accounts'),
        api.get('/api/profiles') // Assuming there's an endpoint to get profiles/suppliers
      ]);
      
      setReceipts(receiptsRes.data.data);
      setAccounts(accountsRes.data.data);
      // Filter suppliers from profiles
      const supplierProfiles = profilesRes.data.data.filter((p: any) => p.type === 'SUPPLIER');
      setSuppliers(supplierProfiles);
    } catch (error) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleAddReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/insumos/receipts', {
        supplierId: formData.supplierId,
        invoiceNumber: formData.invoiceNumber || undefined,
        totalAmount: parseFloat(formData.totalAmount),
        issueDate: formData.issueDate
      });
      toast.success('Recibo registrado com sucesso');
      setShowAddForm(false);
      setFormData({ supplierId: '', invoiceNumber: '', totalAmount: '', issueDate: new Date().toISOString().split('T')[0] });
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao registrar recibo');
    }
  };

  const handleCloseReceipts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedReceipts.length === 0) return toast.error('Selecione pelo menos um recibo');
    
    // Group by supplier
    const selectedSupplierId = receipts.find(r => r.id === selectedReceipts[0])?.supplierId;
    const sameSupplier = selectedReceipts.every(id => receipts.find(r => r.id === id)?.supplierId === selectedSupplierId);
    
    if (!sameSupplier) {
      return toast.error('Selecione recibos de um único fornecedor para fechar a fatura.');
    }

    try {
      await api.post('/api/insumos/receipts/close', {
        supplierId: selectedSupplierId,
        receiptIds: selectedReceipts,
        dueDate: closeData.dueDate,
        stockAccountId: closeData.stockAccountId,
        supplierAccountId: closeData.supplierAccountId,
        notes: closeData.notes
      });
      toast.success('Fatura consolidada com sucesso. Enviada para o Financeiro.');
      setShowCloseModal(false);
      setSelectedReceipts([]);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao consolidar fatura');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedReceipts(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Entradas e Recibos</h2>
          <p className="text-muted-foreground">Registre recebimentos físicos de insumos</p>
        </div>
        <div className="space-x-2">
          {selectedReceipts.length > 0 && (
            <Button onClick={() => setShowCloseModal(true)} variant="default" className="bg-green-600 hover:bg-green-700">
              <CheckSquare className="w-4 h-4 mr-2" /> Consolidar Fatura ({selectedReceipts.length})
            </Button>
          )}
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-2" /> Novo Recibo
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {receipts.map(receipt => (
          <Card key={receipt.id} className={`cursor-pointer transition-colors ${selectedReceipts.includes(receipt.id) ? 'border-primary bg-primary/5' : ''}`} onClick={() => toggleSelect(receipt.id)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex justify-between items-center">
                <span>{receipt.supplier.name}</span>
                <Receipt className="w-5 h-5 text-muted-foreground" />
              </CardTitle>
              <CardDescription>Nota: {receipt.invoiceNumber || 'S/N'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-sm text-muted-foreground">Emitido em</p>
                  <p className="font-medium">{new Date(receipt.issueDate).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="font-bold text-lg text-primary">{formatCurrency(receipt.totalAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {receipts.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            Nenhum recibo pendente.
          </div>
        )}
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Registrar Recebimento</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddReceipt} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fornecedor *</label>
                  <select
                    value={formData.supplierId}
                    onChange={e => setFormData({ ...formData, supplierId: e.target.value })}
                    className="w-full h-10 px-3 py-2 border rounded-md" required
                  >
                    <option value="">Selecione...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Número da Nota Fiscal</label>
                  <Input value={formData.invoiceNumber} onChange={e => setFormData({ ...formData, invoiceNumber: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Valor Total *</label>
                    <Input type="number" step="0.01" value={formData.totalAmount} onChange={e => setFormData({ ...formData, totalAmount: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data de Emissão</label>
                    <Input type="date" value={formData.issueDate} onChange={e => setFormData({ ...formData, issueDate: e.target.value })} required />
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Cancelar</Button>
                  <Button type="submit">Salvar</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {showCloseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Consolidar Fatura (Partidas Dobradas)</CardTitle>
              <CardDescription>Esta ação enviará os recibos ao Financeiro como Contas a Pagar</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCloseReceipts} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-blue-600">Conta de Ativo (Estoque/Insumos) *</label>
                  <select
                    value={closeData.stockAccountId}
                    onChange={e => setCloseData({ ...closeData, stockAccountId: e.target.value })}
                    className="w-full h-10 px-3 py-2 border border-blue-200 rounded-md" required
                  >
                    <option value="">Selecione a conta de destino do ativo...</option>
                    {accounts.filter(a => a.type === 'ASSET' || a.type === 'EXPENSE').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <p className="text-xs text-muted-foreground">Esta conta receberá o débito constando o aumento de valor do estoque.</p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-red-600">Conta de Passivo (Fornecedor) *</label>
                  <select
                    value={closeData.supplierAccountId}
                    onChange={e => setCloseData({ ...closeData, supplierAccountId: e.target.value })}
                    className="w-full h-10 px-3 py-2 border border-red-200 rounded-md" required
                  >
                    <option value="">Selecione a conta da dívida gerada...</option>
                    {accounts.filter(a => a.type === 'LIABILITY').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <p className="text-xs text-muted-foreground">Esta conta receberá o crédito constando a dívida assumida com o fornecedor.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Vencimento da Fatura *</label>
                    <Input type="date" value={closeData.dueDate} onChange={e => setCloseData({ ...closeData, dueDate: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Observações</label>
                    <Input value={closeData.notes} onChange={e => setCloseData({ ...closeData, notes: e.target.value })} />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setShowCloseModal(false)}>Cancelar</Button>
                  <Button type="submit" className="bg-green-600 hover:bg-green-700">Fechar Fatura</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
