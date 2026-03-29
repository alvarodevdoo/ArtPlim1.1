import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { 
  Plus, DollarSign, TrendingUp, TrendingDown, Calendar, Target, RefreshCw, Pencil, Trash, 
  ArrowUpRight, ArrowDownRight, ArrowRight, Activity, BarChart3, PieChart, UserCheck, Users,
  Info, AlertCircle, AlertTriangle, History, CheckCircle, Clock, Wallet, CreditCard
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart as RechartsPieChart,
  Pie
} from 'recharts';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { AccountEntryForm } from '@/components/chartOfAccounts/AccountEntryForm';
import { AccountCombobox } from '@/components/chartOfAccounts/AccountCombobox';
import { DefaultCategoriesModal } from '@/features/financeiro/DefaultCategoriesModal';
import { DefaultChartOfAccountsModal } from '@/features/financeiro/DefaultChartOfAccountsModal';
import { ContasAPagar } from '@/features/financeiro/ContasAPagar';
import { ContasAReceber } from '@/features/financeiro/ContasAReceber';
import { RelatorioDRE } from '@/features/financeiro/RelatorioDRE';
import { RelatorioFluxoCaixa } from '@/features/financeiro/RelatorioFluxoCaixa';

interface Account {
  id: string;
  name: string;
  type: 'CHECKING' | 'SAVINGS' | 'CASH' | 'CREDIT_CARD';
  balance: number;
  bank?: string;
  agency?: string;
  accountNumber?: string;
  _count: {
    transactions: number;
  };
}

interface Transaction {
  id: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  amount: number;
  description: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  dueDate?: string;
  paidAt?: string;
  createdAt: string;
  account: {
    id: string;
    name: string;
    type: string;
  };
  category?: {
    id: string;
    name: string;
    color?: string;
  };
  order?: {
    id: string;
    orderNumber: string;
  };
  performedBy?: {
    name: string;
  };
  profile?: {
    name: string;
  };
}

interface FinancialDashboard {
  summary: {
    totalIncome: number;
    totalExpense: number;
    profit: number;
    profitMargin: number;
  };
  pending: {
    receivables: number;
    payables: number;
  };
  accounts: {
    totalBalance: number;
    balanceByType: Record<string, number>;
  };
  cashFlow: Array<{
    date: string;
    income: number;
    expense: number;
    balance: number;
  }>;
  categoryStats: Array<{
    name: string;
    value: number;
    color: string;
    type: 'INCOME' | 'EXPENSE';
  }>;
  monthlyComparison: {
    currentMonth: {
      income: number;
      expense: number;
      profit: number;
    };
    previousMonth: {
      income: number;
      expense: number;
      profit: number;
    };
    growth: {
      income: number;
      expense: number;
      profit: number;
    };
  };
}

const accountTypeConfig = {
  CHECKING: { label: 'Conta Corrente', icon: CreditCard, color: 'text-blue-500' },
  SAVINGS: { label: 'Poupança', icon: Wallet, color: 'text-green-500' },
  CASH: { label: 'Dinheiro', icon: DollarSign, color: 'text-yellow-500' },
  CREDIT_CARD: { label: 'Cartão de Crédito', icon: CreditCard, color: 'text-purple-500' }
};

const transactionStatusConfig = {
  PENDING: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  PAID: { label: 'Pago', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  OVERDUE: { label: 'Vencido', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  CANCELLED: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800', icon: AlertCircle }
};

const accountNatureConfig = {
  ASSET: { label: 'Ativo', colors: 'bg-blue-100 text-blue-700' },
  LIABILITY: { label: 'Passivo', colors: 'bg-orange-100 text-orange-700' },
  EQUITY: { label: 'Patrimônio', colors: 'bg-purple-100 text-purple-700' },
  REVENUE: { label: 'Receita', colors: 'bg-green-100 text-green-700' },
  REVENUE_DEDUCTION: { label: 'Dedução', colors: 'bg-red-100 text-red-700' },
  COST: { label: 'Custo', colors: 'bg-amber-100 text-amber-700' },
  EXPENSE: { label: 'Despesa', colors: 'bg-rose-100 text-rose-700' },
  RESULT_CALCULATION: { label: 'Apuração', colors: 'bg-indigo-100 text-indigo-700' },
  CONTROL: { label: 'Controle', colors: 'bg-slate-100 text-slate-700' },
} as Record<string, { label: string; colors: string }>;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const Financeiro: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<FinancialDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'dashboard');
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showDefaultCategoriesModal, setShowDefaultCategoriesModal] = useState(false);
  const [showDefaultChartModal, setShowDefaultChartModal] = useState(false);
  const [showAddChartAccount, setShowAddChartAccount] = useState(false);
  const [showChartInfo, setShowChartInfo] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [accountToEdit, setAccountToEdit] = useState<any>(null);
  const [parentAccountForNew, setParentAccountForNew] = useState<any>(null);
  const [accountToDeleteWithDependencies, setAccountToDeleteWithDependencies] = useState<any>(null);
  const [deletionDependencies, setDeletionDependencies] = useState<any[]>([]);
  const [replacementAccountId, setReplacementAccountId] = useState<string>('');
  const [showInactiveChartAccounts, setShowInactiveChartAccounts] = useState(false);
  const [chartOfAccounts, setChartOfAccounts] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState('30'); // dias
  const [filterAccountId, setFilterAccountId] = useState<string | null>(null);

  const handleDeleteAccount = async (id: string, name: string, transactionCount: number) => {
    const isSoftDelete = transactionCount > 0;
    const message = isSoftDelete 
      ? `A conta "${name}" possui ${transactionCount} transação(ões) vinculada(s). Se você confirmar, ela será DESATIVADA (soft delete) para preservar seu histórico financeiro, mas não aparecerá mais nos novos lançamentos. Confirma?`
      : `Deseja excluir permanentemente a conta "${name}"? Esta ação não pode ser desfeita.`;

    if (!confirm(message)) return;

    try {
      await api.delete(`/api/finance/accounts/${id}`);
      toast.success(isSoftDelete ? 'Conta desativada com sucesso!' : 'Conta removida definitivamente!');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao remover conta.');
    }
  };

  const [accountForm, setAccountForm] = useState({
    name: '',
    type: 'CHECKING' as const,
    balance: '0',
    bank: '',
    agency: '',
    accountNumber: ''
  });

  const [transactionForm, setTransactionForm] = useState({
    accountId: '',
    type: 'INCOME' as const,
    amount: '',
    description: '',
    categoryId: '',
    dueDate: '',
    profileId: ''
  });

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    type: 'EXPENSE' as 'EXPENSE' | 'INCOME',
    color: '#EF4444',
    chartOfAccountId: ''
  });

  // Sincronizar tab com URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (dateRange) {
      loadData();
    }
  }, [dateRange]);

  const loadData = async () => {
    try {
      const [accountsResponse, transactionsResponse, dashboardResponse, categoriesResponse, chartOfAccountsResponse, profilesResponse] = await Promise.all([
        api.get('/api/finance/accounts'),
        api.get(`/api/finance/transactions?limit=50`),
        api.get(`/api/finance/dashboard?days=${dateRange}`),
        api.get('/api/finance/categories'),
        api.get(`/api/finance/chart-of-accounts${showInactiveChartAccounts ? '?includeInactive=true' : ''}`),
        api.get('/api/profiles')
      ]);

      setAccounts(accountsResponse.data.data);
      setTransactions(transactionsResponse.data.data);
      setDashboard(dashboardResponse.data.data);
      setCategories(categoriesResponse.data.data);
      setChartOfAccounts(chartOfAccountsResponse.data.data);
      setProfiles(profilesResponse.data.data);
    } catch (error) {
      toast.error('Erro ao carregar dados financeiros');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchCharts = async () => {
      try {
        const response = await api.get(`/api/finance/chart-of-accounts${showInactiveChartAccounts ? '?includeInactive=true' : ''}`);
        setChartOfAccounts(response.data.data);
      } catch (error) {}
    };
    fetchCharts();
  }, [showInactiveChartAccounts]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload = {
        name: accountForm.name,
        type: accountForm.type,
        balance: parseFloat(accountForm.balance),
        bank: accountForm.bank || null,
        agency: accountForm.agency || null,
        accountNumber: accountForm.accountNumber || null
      };

      if (editingAccountId) {
        await api.put(`/api/finance/accounts/${editingAccountId}`, payload);
        toast.success('Conta atualizada com sucesso!');
      } else {
        await api.post('/api/finance/accounts', payload);
        toast.success('Conta criada com sucesso!');
      }

      setShowAddAccount(false);
      setEditingAccountId(null);
      resetAccountForm();
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao processar conta');
    }
  };

  const handleEditAccount = (account: Account) => {
    setEditingAccountId(account.id);
    setAccountForm({
      name: account.name,
      type: account.type as any,
      balance: account.balance.toString(),
      bank: account.bank || '',
      agency: account.agency || '',
      accountNumber: account.accountNumber || ''
    });
    setShowAddAccount(true);
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await api.post('/api/finance/transactions', {
        accountId: transactionForm.accountId,
        type: transactionForm.type,
        amount: parseFloat(transactionForm.amount),
        description: transactionForm.description,
        categoryId: transactionForm.categoryId || undefined,
        dueDate: transactionForm.dueDate || undefined
      });

      toast.success('Transação criada com sucesso!');
      setShowAddTransaction(false);
      resetTransactionForm();
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao criar transação');
    }
  };

  const handlePayTransaction = async (id: string) => {
    try {
      await api.post(`/api/finance/transactions/${id}/pay`);
      toast.success('Transação marcada como paga!');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao marcar como paga');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação Obrigatória: Deve ter conta analítica no sistema e vinculada
    const hasAnalytics = chartOfAccounts.some(acc => acc.type === 'ANALYTIC');
    if (!hasAnalytics) {
      toast.error('Impossível salvar: Você deve configurar o Plano de Contas primeiro.');
      return;
    }

    if (!categoryForm.chartOfAccountId) {
      toast.error('Selecione uma conta analítica para vincular esta categoria.');
      return;
    }

    try {
      if (editingCategoryId) {
        await api.put(`/api/finance/categories/${editingCategoryId}`, categoryForm);
        toast.success('Categoria atualizada!');
      } else {
        await api.post('/api/finance/categories', categoryForm);
        toast.success('Categoria criada!');
      }
      setShowAddCategory(false);
      setEditingCategoryId(null);
      setCategoryForm({ name: '', type: 'EXPENSE', color: '#EF4444', chartOfAccountId: '' });
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao processar categoria');
    }
  };

  const handleEditCategory = (category: any) => {
    setEditingCategoryId(category.id);
    setCategoryForm({
      name: category.name,
      type: category.type,
      color: category.color || (category.type === 'INCOME' ? '#10B981' : '#EF4444'),
      chartOfAccountId: category.chartOfAccountId || ''
    });
    setShowAddCategory(true);
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta categoria?')) return;
    try {
      await api.delete(`/api/finance/categories/${id}`);
      toast.success('Categoria removida!');
      loadData();
    } catch (error: any) {
      toast.error('Não é possível remover categorias em uso por transações.');
    }
  };

  // Lógica anterior do handleCreateChartAccount removida

  const handleDeleteChartAccount = async (id: string, replaceId?: string) => {
    if (!replaceId && !confirm('Tem certeza que deseja remover esta conta contábil?')) return;
    try {
      const query = replaceId ? `?replacementAccountId=${replaceId}` : '';
      await api.delete(`/api/finance/v2/chart-of-accounts/${id}${query}`);
      toast.success(replaceId ? 'Conta remanejada e desativada (soft delete) com sucesso!' : 'Conta contábil removida (soft delete)!');
      
      if (replaceId) {
        setAccountToDeleteWithDependencies(null);
        setDeletionDependencies([]);
        setReplacementAccountId('');
      }
      loadData();
    } catch (error: any) {
      if (error.response?.data?.code === 'HAS_DEPENDENCIES') {
        const accountInfo = chartOfAccounts.find(c => c.id === id);
        setAccountToDeleteWithDependencies(accountInfo);
        setDeletionDependencies(error.response.data.dependencies?.materials || []);
      } else {
        toast.error(error.response?.data?.message || 'Não é possível remover a conta contábil.');
      }
    }
  };

  const handleEditChartAccount = (account: any) => {
    setAccountToEdit(account);
    setParentAccountForNew(null);
    setShowAddChartAccount(true);
  };

  const handleAddChildChartAccount = (parentAccount: any) => {
    setAccountToEdit(null);
    setParentAccountForNew(parentAccount);
    setShowAddChartAccount(true);
  };

  const handleRestoreChartAccount = async (id: string) => {
    try {
      await api.patch(`/api/finance/v2/chart-of-accounts/${id}/restore`);
      toast.success('Conta contábil recuperada com sucesso!');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao recuperar conta.');
    }
  };

  const resetAccountForm = () => {
    setEditingAccountId(null);
    setAccountForm({
      name: '',
      type: 'CHECKING',
      balance: '0',
      bank: '',
      agency: '',
      accountNumber: ''
    });
  };

  const resetTransactionForm = () => {
    setTransactionForm({
      accountId: '',
      type: 'INCOME',
      amount: '',
      description: '',
      categoryId: '',
      dueDate: '',
      profileId: ''
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Financeiro</h1>
          <p className="text-muted-foreground">
            Controle financeiro completo - contas, transações e fluxo de caixa
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <select
            value={dateRange}
            onChange={(e) => {
              setDateRange(e.target.value);
              setLoading(true);
            }}
            className="h-10 px-3 py-2 border border-input rounded-md bg-background"
          >
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="365">Último ano</option>
          </select>
          <Button variant="outline" onClick={loadData} size="icon">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={() => setShowDefaultCategoriesModal(true)} className="border-primary text-primary hover:bg-primary/5">
            <RefreshCw className="w-4 h-4 mr-2" />
            Categorias Padrão
          </Button>
          <Button variant="outline" onClick={() => setShowAddAccount(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Conta
          </Button>
          <Button onClick={() => setShowAddTransaction(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Transação
          </Button>
        </div>
      </div>

      {/* Dashboard Cards */}
      {dashboard && dashboard.summary && (
        <>
          {/* Métricas Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Receitas</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(dashboard.summary.totalIncome)}
                    </p>
                    {dashboard.monthlyComparison && (
                      <div className="flex items-center mt-1">
                        {dashboard.monthlyComparison.growth.income >= 0 ? (
                          <ArrowUpRight className="w-4 h-4 text-green-500" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-red-500" />
                        )}
                        <span className={`text-sm ${dashboard.monthlyComparison.growth.income >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {Math.abs(dashboard.monthlyComparison.growth.income).toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-green-100 rounded-full">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Despesas</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(dashboard.summary.totalExpense)}
                    </p>
                    {dashboard.monthlyComparison && (
                      <div className="flex items-center mt-1">
                        {dashboard.monthlyComparison.growth.expense >= 0 ? (
                          <ArrowUpRight className="w-4 h-4 text-red-500" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-green-500" />
                        )}
                        <span className={`text-sm ${dashboard.monthlyComparison.growth.expense >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {Math.abs(dashboard.monthlyComparison.growth.expense).toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-red-100 rounded-full">
                    <TrendingDown className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Lucro</p>
                    <p className={`text-2xl font-bold ${dashboard.summary.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(dashboard.summary.profit)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Margem: {dashboard.summary.profitMargin.toFixed(1)}%
                    </p>
                  </div>
                  <div className={`p-3 rounded-full ${dashboard.summary.profit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                    <Target className={`w-6 h-6 ${dashboard.summary.profit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Saldo Total</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(dashboard.accounts.totalBalance)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {accounts.length} conta(s)
                    </p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-full">
                    <Wallet className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contas a Receber e Pagar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-orange-500" />
                  <span>Contas a Receber</span>
                </CardTitle>
                <CardDescription>
                  Valores pendentes de recebimento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <p className="text-3xl font-bold text-orange-600">
                    {formatCurrency(dashboard.pending.receivables)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Total a receber
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <span>Contas a Pagar</span>
                </CardTitle>
                <CardDescription>
                  Valores pendentes de pagamento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <p className="text-3xl font-bold text-red-600">
                    {formatCurrency(dashboard.pending.payables)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Total a pagar
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Tabs */}
      <div className="border-b border-border overflow-x-auto no-scrollbar">
        <nav className="flex space-x-8 min-w-max px-4">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'accounts', label: 'Contas' },
            { id: 'transactions', label: 'Transações' },
            { id: 'receivables', label: 'A Receber' },
            { id: 'payables', label: 'A Pagar' },
            { id: 'dre', label: 'DRE' },
            { id: 'cash-flow', label: 'Fluxo de Caixa' },
            { id: 'categories', label: 'Categorias' },
            { id: 'chart-of-accounts', label: 'Plano de Contas' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && dashboard && (
        <div className="space-y-6">
          {/* Gráficos Principais */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fluxo de Caixa */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="w-5 h-5" />
                  <span>Fluxo de Caixa</span>
                </CardTitle>
                <CardDescription>
                  Evolução das receitas e despesas nos últimos {dateRange} dias
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard.cashFlow && dashboard.cashFlow.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={dashboard.cashFlow}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        formatter={(value: any, name: any) => [
                          formatCurrency(Number(value) || 0),
                          name === 'income' ? 'Receitas' : name === 'expense' ? 'Despesas' : 'Saldo'
                        ]}
                        labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                      />
                      <Area
                        type="monotone"
                        dataKey="income"
                        stackId="1"
                        stroke="#10B981"
                        fill="#10B981"
                        fillOpacity={0.6}
                      />
                      <Area
                        type="monotone"
                        dataKey="expense"
                        stackId="2"
                        stroke="#EF4444"
                        fill="#EF4444"
                        fillOpacity={0.6}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Dados insuficientes para gerar o gráfico</p>
                    <p className="text-sm">Registre algumas transações para visualizar o fluxo de caixa</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Distribuição por Categorias */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <PieChart className="w-5 h-5" />
                  <span>Distribuição por Categorias</span>
                </CardTitle>
                <CardDescription>
                  Breakdown das despesas por categoria
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard.categoryStats && dashboard.categoryStats.length > 0 ? (
                  <div className="space-y-4">
                    <ResponsiveContainer width="100%" height={200}>
                      <RechartsPieChart>
                        <Pie
                          data={dashboard.categoryStats.filter(cat => cat.type === 'EXPENSE')}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {dashboard.categoryStats.filter(cat => cat.type === 'EXPENSE').map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                      </RechartsPieChart>
                    </ResponsiveContainer>

                    <div className="space-y-2">
                      {dashboard.categoryStats.filter(cat => cat.type === 'EXPENSE').map((category, index) => (
                        <div key={category.name} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="text-sm">{category.name}</span>
                          </div>
                          <span className="text-sm font-medium">{formatCurrency(category.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <PieChart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma categoria encontrada</p>
                    <p className="text-sm">Categorize suas transações para ver a distribuição</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Comparação Mensal */}
          {dashboard.monthlyComparison && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5" />
                  <span>Comparação Mensal</span>
                </CardTitle>
                <CardDescription>
                  Performance do mês atual vs. mês anterior
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">Receitas</p>
                    <p className="text-2xl font-bold text-green-600 mb-1">
                      {formatCurrency(dashboard.monthlyComparison.currentMonth.income)}
                    </p>
                    <div className="flex items-center justify-center space-x-1">
                      {dashboard.monthlyComparison.growth.income >= 0 ? (
                        <ArrowUpRight className="w-4 h-4 text-green-500" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-red-500" />
                      )}
                      <span className={`text-sm ${dashboard.monthlyComparison.growth.income >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {Math.abs(dashboard.monthlyComparison.growth.income).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      vs. {formatCurrency(dashboard.monthlyComparison.previousMonth.income)}
                    </p>
                  </div>

                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">Despesas</p>
                    <p className="text-2xl font-bold text-red-600 mb-1">
                      {formatCurrency(dashboard.monthlyComparison.currentMonth.expense)}
                    </p>
                    <div className="flex items-center justify-center space-x-1">
                      {dashboard.monthlyComparison.growth.expense >= 0 ? (
                        <ArrowUpRight className="w-4 h-4 text-red-500" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-green-500" />
                      )}
                      <span className={`text-sm ${dashboard.monthlyComparison.growth.expense >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {Math.abs(dashboard.monthlyComparison.growth.expense).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      vs. {formatCurrency(dashboard.monthlyComparison.previousMonth.expense)}
                    </p>
                  </div>

                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">Lucro</p>
                    <p className={`text-2xl font-bold mb-1 ${dashboard.monthlyComparison.currentMonth.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(dashboard.monthlyComparison.currentMonth.profit)}
                    </p>
                    <div className="flex items-center justify-center space-x-1">
                      {dashboard.monthlyComparison.growth.profit >= 0 ? (
                        <ArrowUpRight className="w-4 h-4 text-green-500" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-red-500" />
                      )}
                      <span className={`text-sm ${dashboard.monthlyComparison.growth.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {Math.abs(dashboard.monthlyComparison.growth.profit).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      vs. {formatCurrency(dashboard.monthlyComparison.previousMonth.profit)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Distribuição de Saldos por Tipo de Conta */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Wallet className="w-5 h-5" />
                <span>Saldos por Tipo de Conta</span>
              </CardTitle>
              <CardDescription>
                Distribuição do patrimônio por tipo de conta
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard.accounts.balanceByType && Object.keys(dashboard.accounts.balanceByType).length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(dashboard.accounts.balanceByType).map(([type, balance]) => ({
                    type: accountTypeConfig[type as keyof typeof accountTypeConfig]?.label || type,
                    amount: balance, // Changed from 'balance' to 'amount'
                    color: COLORS[Object.keys(dashboard.accounts.balanceByType).indexOf(type) % COLORS.length]
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                      {Object.entries(dashboard.accounts.balanceByType).map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma conta cadastrada</p>
                  <p className="text-sm">Crie contas para visualizar a distribuição de saldos</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Accounts Tab */}
      {activeTab === 'accounts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => {
            const typeConfig = accountTypeConfig[account.type];
            const Icon = typeConfig.icon;

            return (
              <Card key={account.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg flex items-center space-x-2">
                        <Icon className={`w-5 h-5 ${typeConfig.color}`} />
                        <span>{account.name}</span>
                      </CardTitle>
                      <CardDescription>{typeConfig.label}</CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" title="Ver Histórico" onClick={() => {
                        setFilterAccountId(account.id);
                        handleTabChange('transactions');
                      }} className="h-8 w-8 text-slate-400 hover:text-primary">
                        <History className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Editar Conta" onClick={() => handleEditAccount(account)} className="h-8 w-8 text-slate-400 hover:text-slate-600">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Excluir Conta" onClick={() => handleDeleteAccount(account.id, account.name, account._count.transactions)} className="h-8 w-8 text-slate-400 hover:text-red-500">
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-center py-4">
                      <p className={`text-2xl font-bold ${account.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(account.balance)}
                      </p>
                      <p className="text-sm text-muted-foreground">Saldo atual</p>
                    </div>
                    {account.bank && (
                      <p className="text-sm">
                        <span className="font-medium">Banco:</span> {account.bank}
                      </p>
                    )}
                    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Saldo Atual</p>
                        <p className={`text-2xl font-bold flex items-center space-x-2 ${account.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          <span>{formatCurrency(account.balance)}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground mb-1">
                          {account._count.transactions} transação(ões)
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold">Gestão de Categorias</h2>
              <p className="text-sm text-muted-foreground">Configure suas categorias operacionais de receita e despesa</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowDefaultCategoriesModal(true)} className="border-primary text-primary hover:bg-primary/5">
                <RefreshCw className="w-4 h-4 mr-2" />
                Gerar Categorias Padrão
              </Button>
              <Button onClick={() => setShowAddCategory(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Categoria
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-green-600 flex items-center gap-2"><TrendingUp className="w-5 h-5" /> Receitas</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {categories.filter(c => c.type === 'INCOME').length === 0 && <p className="text-sm text-muted-foreground">Nenhuma categoria encontrada.</p>}
                {categories.filter(c => c.type === 'INCOME').map(c => (
                  <div key={c.id} className="flex justify-between items-center p-3 text-sm border rounded hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: c.color || '#10B981' }} />
                      <span className="font-medium">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEditCategory(c)}>
                        <Pencil className="w-4 h-4 text-slate-400" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(c.id)}>
                        <Trash className="w-4 h-4 text-slate-400 hover:text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-red-600 flex items-center gap-2"><TrendingDown className="w-5 h-5" /> Despesas</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {categories.filter(c => c.type === 'EXPENSE').length === 0 && <p className="text-sm text-muted-foreground">Nenhuma categoria encontrada.</p>}
                {categories.filter(c => c.type === 'EXPENSE').map(c => (
                  <div key={c.id} className="flex justify-between items-center p-3 text-sm border rounded hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: c.color || '#EF4444' }} />
                      <span className="font-medium">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEditCategory(c)}>
                        <Pencil className="w-4 h-4 text-slate-400" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(c.id)}>
                        <Trash className="w-4 h-4 text-slate-400 hover:text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Chart of Accounts Tab (Direct Access) */}
      {activeTab === 'chart-of-accounts' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                Plano de Contas
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-slate-400 hover:text-primary transition-colors" onClick={() => setShowChartInfo(true)}>
                  <Info className="w-4 h-4" />
                </Button>
              </h2>
              <p className="text-sm text-muted-foreground">Hierarquia oficial de contas para relatórios contábeis e DRE</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900 transition-colors bg-slate-100 px-3 py-2 rounded-lg border border-slate-200 mr-2">
                <input 
                  type="checkbox" 
                  checked={showInactiveChartAccounts}
                  onChange={(e) => setShowInactiveChartAccounts(e.target.checked)}
                  className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                />
                <span className="font-medium">Exibir apagados (Lixeira)</span>
              </label>
              
              <Button variant="outline" onClick={() => setShowDefaultChartModal(true)} className="border-primary text-primary hover:bg-primary/5">
                <RefreshCw className="w-4 h-4 mr-2" />
                Plano de Contas Padrão
              </Button>
              
              <Button onClick={() => {
                setAccountToEdit(null);
                setParentAccountForNew(null);
                setShowAddChartAccount(true);
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Conta Contábil
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="border-x border-b rounded-b-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-y border-slate-200">
                      <th className="text-left p-3 font-bold text-slate-600 w-32">Código</th>
                      <th className="text-left p-3 font-bold text-slate-600">Nome da Conta</th>
                      <th className="text-left p-3 font-bold text-slate-600 w-48">Natureza / Tipo</th>
                      <th className="text-right p-3 font-bold text-slate-600 w-48">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {chartOfAccounts.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-muted-foreground italic">
                          <Target className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                          Nenhuma conta cadastrada no plano de contas.
                        </td>
                      </tr>
                    )}
                    {chartOfAccounts
                      .sort((a, b) => {
                        const codeA = a.code || '';
                        const codeB = b.code || '';
                        return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
                      })
                      .map(account => (
                      <tr key={account.id} className={`hover:bg-slate-50 transition-colors ${account.active === false ? 'bg-slate-50/50' : ''}`}>
                        <td className={`p-3 font-mono text-xs font-bold ${account.active === false ? 'text-slate-400' : 'text-primary'}`}>
                          {account.code || '—'}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {account.code?.split('.').length > 1 && (
                              <div className="flex gap-1 opacity-50">
                                {Array.from({ length: account.code.split('.').length - 1 }).map((_, i) => (
                                  <div key={i} className="w-4 border-l border-slate-200 h-4" />
                                ))}
                              </div>
                            )}
                            <span className={`${account.type === 'SYNTHETIC' ? 'font-bold text-slate-900' : 'text-slate-700'} ${account.active === false ? 'line-through text-slate-400' : ''}`}>
                              {account.name}
                            </span>
                            {account.active === false && (
                              <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase font-bold ml-1">
                                Excluída
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {(() => {
                              const conf = accountNatureConfig[account.nature] || { label: account.nature, colors: 'bg-gray-100 text-gray-700' };
                              return (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap ${account.active === false ? 'bg-slate-100 text-slate-400 grayscale' : conf.colors}`}>
                                  {conf.label}
                                </span>
                              );
                            })()}
                            <span title={account.type === 'SYNTHETIC' ? 'Sintética' : 'Analítica'} className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap ${account.active === false ? 'bg-slate-100 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                              {account.type === 'SYNTHETIC' ? '[S]' : '[A]'}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          {account.active === false ? (
                            <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-8" onClick={() => handleRestoreChartAccount(account.id)}>
                              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Restaurar
                            </Button>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" title="Adicionar Subconta" onClick={() => handleAddChildChartAccount(account)} className="h-8 w-8">
                                <Plus className="w-4 h-4 text-slate-400 hover:text-primary" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Editar Conta" onClick={() => handleEditChartAccount(account)} className="h-8 w-8">
                                <Pencil className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                              </Button>
                              <Button variant="ghost" size="icon" className="group h-8 w-8" onClick={() => handleDeleteChartAccount(account.id)} title="Excluir">
                                <Trash className="w-4 h-4 text-slate-400 group-hover:text-red-500" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {filterAccountId && (
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <div className="flex items-center text-blue-700 text-sm">
                <Info className="w-4 h-4 mr-2" />
                Exibindo apenas transações da conta: <strong>{accounts.find(a => a.id === filterAccountId)?.name}</strong>
              </div>
              <Button size="sm" variant="link" onClick={() => setFilterAccountId(null)} className="text-blue-700 hover:text-blue-900 h-auto p-0">
                Limpar filtro
              </Button>
            </div>
          )}
          {transactions.filter(t => !filterAccountId || t.account.id === filterAccountId).length === 0 ? (
            <div className="text-center py-16 text-muted-foreground bg-slate-50 border border-dashed rounded-lg">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Nenhuma transação encontrada</p>
              <p className="text-sm">Registre suas receitas e despesas para visualizar o extrato.</p>
            </div>
          ) : (
            transactions
              .filter(t => !filterAccountId || t.account.id === filterAccountId)
              .map((transaction) => {
                const statusInfo = transactionStatusConfig[transaction.status];
                const StatusIcon = statusInfo.icon;

                return (
                  <Card key={transaction.id}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className={`p-2 rounded-full ${transaction.type === 'INCOME' ? 'bg-green-100' : 'bg-red-100'}`}>
                            {transaction.type === 'INCOME' ? (
                              <TrendingUp className="w-5 h-5 text-green-600" />
                            ) : (
                              <TrendingDown className="w-5 h-5 text-red-600" />
                            )}
                          </div>

                          <div>
                            <h4 className="font-medium">{transaction.description}</h4>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                              <div className="flex items-center">
                                <span>{transaction.account.name}</span>
                                {transaction.category && (
                                  <>
                                    <span className="mx-1.5 opacity-50">•</span>
                                    <span>{transaction.category.name}</span>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center">
                                <Calendar className="w-3 h-3 mr-1 opacity-70" />
                                <span>{formatDateTime(transaction.createdAt)}</span>
                              </div>
                              {transaction.performedBy && (
                                <div className="flex items-center bg-secondary/50 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider">
                                  <UserCheck className="w-3 h-3 mr-1" />
                                  <span>Op: {transaction.performedBy.name.split(' ')[0]}</span>
                                </div>
                              )}
                              {transaction.profile && (
                                <div className="flex items-center text-primary font-medium">
                                  <Users className="w-3 h-3 mr-1" />
                                  <span>{transaction.profile.name}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className={`font-semibold ${transaction.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                              {transaction.type === 'INCOME' ? '+' : '-'}{formatCurrency(transaction.amount)}
                            </p>
                            <div className="flex items-center space-x-2">
                              <StatusIcon className="w-4 h-4" />
                              <span className={`px-2 py-1 rounded text-xs ${statusInfo.color}`}>
                                {statusInfo.label}
                              </span>
                            </div>
                          </div>

                          {transaction.status === 'PENDING' && (
                            <Button
                              size="sm"
                              onClick={() => handlePayTransaction(transaction.id)}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Marcar como Pago
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
          )}
        </div>
      )}

      {/* Add Account Modal */}
      {showAddAccount && (
        <div className="modal-overlay">
          <Card className="modal-content-card max-w-md">

            <CardHeader>
              <CardTitle>{editingAccountId ? 'Editar Conta' : 'Nova Conta'}</CardTitle>
              <CardDescription>{editingAccountId ? 'Atualize os dados bancários' : 'Adicione uma nova conta ao sistema'}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">

              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome da Conta *</label>
                  <Input
                    value={accountForm.name}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Conta Corrente Banco do Brasil"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo *</label>
                  <select
                    value={accountForm.type}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                    required
                  >
                    <option value="CHECKING">Conta Corrente</option>
                    <option value="SAVINGS">Poupança</option>
                    <option value="CASH">Dinheiro</option>
                    <option value="CREDIT_CARD">Cartão de Crédito</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Saldo Inicial (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={accountForm.balance}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, balance: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Banco</label>
                  <Input
                    value={accountForm.bank}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, bank: e.target.value }))}
                    placeholder="Ex: Banco do Brasil"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddAccount(false);
                      resetAccountForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">{editingAccountId ? 'Salvar Configurações' : 'Criar Conta'}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {showAddTransaction && (
        <div className="modal-overlay">
          <Card className="modal-content-card max-w-md">

            <CardHeader>
              <CardTitle>Nova Transação</CardTitle>
              <CardDescription>Registre uma receita ou despesa</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">

              <form onSubmit={handleCreateTransaction} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Conta *</label>
                  <select
                    value={transactionForm.accountId}
                    onChange={(e) => setTransactionForm(prev => ({ ...prev, accountId: e.target.value }))}
                    className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                    required
                  >
                    <option value="">Selecione uma conta</option>
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo *</label>
                  <select
                    value={transactionForm.type}
                    onChange={(e) => setTransactionForm(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                    required
                  >
                    <option value="INCOME">Receita</option>
                    <option value="EXPENSE">Despesa</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Valor (R$) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={transactionForm.amount}
                    onChange={(e) => setTransactionForm(prev => ({ ...prev, amount: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição *</label>
                  <Input
                    value={transactionForm.description}
                    onChange={(e) => setTransactionForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Ex: Venda de produtos"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Categoria</label>
                  <select
                    value={transactionForm.categoryId}
                    onChange={(e) => setTransactionForm(prev => ({ ...prev, categoryId: e.target.value }))}
                    className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                  >
                    <option value="">Selecione uma categoria</option>
                    {categories
                      .filter(cat => cat.type === transactionForm.type)
                      .map(category => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Data de Vencimento</label>
                  <Input
                    type="date"
                    value={transactionForm.dueDate}
                    onChange={(e) => setTransactionForm(prev => ({ ...prev, dueDate: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Entidade (Cliente/Fornecedor)</label>
                  <select
                    value={transactionForm.profileId}
                    onChange={(e) => setTransactionForm(prev => ({ ...prev, profileId: e.target.value }))}
                    className="w-full h-10 px-3 py-2 border border-input rounded-md bg-background"
                  >
                    <option value="">Nenhuma entidade vinculada</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.type === 'CUSTOMER' ? 'Cliente' : 'Forn.'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddTransaction(false);
                      resetTransactionForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">Criar Transação</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {showAddCategory && (
        <div className="modal-overlay">
          <Card className="modal-content-card max-w-md">

            <CardHeader>
              <CardTitle>{editingCategoryId ? 'Editar Categoria' : 'Nova Categoria'}</CardTitle>
              <CardDescription>{editingCategoryId ? 'Atualize os dados da categoria' : 'Crie uma classificação para suas transações'}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">

              <form onSubmit={handleCreateCategory} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome *</label>
                  <Input
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Fornecedores, Salários..."
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo *</label>
                    <select
                      value={categoryForm.type}
                      onChange={(e) => setCategoryForm(prev => ({ ...prev, type: e.target.value as 'INCOME' | 'EXPENSE' }))}
                      className="w-full h-10 px-3 border rounded-md"
                    >
                      <option value="EXPENSE">Despesa (Saída)</option>
                      <option value="INCOME">Receita (Entrada)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Cor</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={categoryForm.color}
                        onChange={(e) => setCategoryForm(prev => ({ ...prev, color: e.target.value }))}
                        className="w-10 h-10 p-1 border rounded-md cursor-pointer"
                      />
                      <span className="text-sm text-muted-foreground">{categoryForm.color}</span>
                    </div>
                  </div>
                </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Conta no Plano (Contabil/DRE)</label>
                    {chartOfAccounts.filter(acc => acc.type === 'ANALYTIC').length === 0 ? (
                      <div className="bg-amber-50 border border-amber-200 p-3 rounded-md mt-1">
                        <p className="text-xs text-amber-700 font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Nenhuma conta analítica encontrada.
                        </p>
                        <p className="text-[10px] text-amber-600 mt-0.5 leading-relaxed">
                          É necessário cadastrar o Plano de Contas primeiro para vincular categorias e permitir a geração automática do DRE e Relatórios.
                        </p>
                        <Button 
                          type="button" 
                          variant="default" 
                          size="sm" 
                          className="h-8 text-[11px] bg-amber-600 hover:bg-amber-700 text-white mt-3 shadow-sm font-semibold px-4"
                          onClick={() => {
                            setShowAddCategory(false);
                            setActiveTab('chart-of-accounts');
                          }}
                        >
                          <ArrowRight className="w-3 h-3 mr-1.5" />
                          Configurar Plano de Contas
                        </Button>
                      </div>
                    ) : (
                      <AccountCombobox 
                         value={categoryForm.chartOfAccountId}
                         onChange={(val) => setCategoryForm(prev => ({ ...prev, chartOfAccountId: val }))}
                         placeholder="Vincular a uma conta analítica..."
                      />
                    )}
                    <p className="text-[10px] text-muted-foreground italic">Vincule a uma conta analítica [A] para que esta categoria reflita nos relatórios de faturamento e lucro.</p>
                  </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="ghost" onClick={() => {
                    setShowAddCategory(false);
                    setEditingCategoryId(null);
                    setCategoryForm({ name: '', type: 'EXPENSE', color: '#EF4444', chartOfAccountId: '' });
                  }}>Cancelar</Button>
                  <Button 
                    type="submit" 
                    disabled={chartOfAccounts.filter(acc => acc.type === 'ANALYTIC').length === 0}
                  >
                    {editingCategoryId ? 'Salvar Alterações' : 'Salvar'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {showAddChartAccount && (
        <div className="modal-overlay">
          <Card className="modal-content-card max-w-md w-full relative">
            <Button
              variant="ghost" 
              size="icon"
              className="absolute right-4 top-4"
              onClick={() => {
                setShowAddChartAccount(false);
              }}
            >
              <Trash className="w-4 h-4" /> {/* Botão estético de fechar... ou um X... vamos colocar 'Cancelar' abaixo */}
            </Button>
            <CardContent className="pt-6">
              <AccountEntryForm 
                isCreationMode={!accountToEdit}
                accountToEdit={accountToEdit || (parentAccountForNew ? { parentId: parentAccountForNew.id, nature: parentAccountForNew.nature } : null)}
                onSuccess={() => {
                  setShowAddChartAccount(false);
                  setAccountToEdit(null);
                  setParentAccountForNew(null);
                  loadData();
                  toast.success('Plano de Contas atualizado!');
                }}
              />
              <div className="flex justify-end mt-2">
                 <Button type="button" variant="ghost" onClick={() => setShowAddChartAccount(false)}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Migration Modal for Dependencies */}
      {accountToDeleteWithDependencies && (
        <div className="modal-overlay z-[9999]">
          <Card className="modal-content-card max-w-lg w-full">
            <CardHeader className="bg-red-50 border-b border-red-100 rounded-t-xl pb-4">
              <CardTitle className="text-red-800 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Migração Obrigatória
              </CardTitle>
              <CardDescription className="text-red-700 mt-1">
                A conta <strong>{accountToDeleteWithDependencies.code} - {accountToDeleteWithDependencies.name}</strong> não pode ser excluída diretamente. Ela possui materiais e históricos vitais atrelados a ela.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded text-sm text-slate-600 max-h-40 overflow-y-auto font-mono">
                <p className="font-bold mb-2 text-slate-700">Recursos Mapeados ({deletionDependencies.length}):</p>
                <ul className="list-disc pl-5 space-y-1">
                  {deletionDependencies.map((dep, idx) => (
                    <li key={idx}>{dep.name || dep.id} (Material)</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2 mt-4">
                <label className="text-sm font-bold text-slate-800">
                  Para onde migrar os recursos? (Nova Conta)
                </label>
                <select 
                  className="w-full h-10 px-3 border border-slate-300 rounded focus:border-primary shadow-sm"
                  value={replacementAccountId}
                  onChange={e => setReplacementAccountId(e.target.value)}
                >
                  <option value="">Selecione a conta de destino...</option>
                  {chartOfAccounts
                    .filter(c => c.id !== accountToDeleteWithDependencies.id && c.type === 'ANALYTIC') // Only analytics for materials usually
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.code} - {c.name}
                      </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">Ao migrar, os históricos antigos permanecerão inalterados (Soft Delete) e os materiais receberão o novo código imediatamente.</p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => {
                    setAccountToDeleteWithDependencies(null);
                    setDeletionDependencies([]);
                    setReplacementAccountId('');
                  }}
                >
                  Cancelar, manter conta
                </Button>
                <Button 
                  disabled={!replacementAccountId}
                  onClick={() => handleDeleteChartAccount(accountToDeleteWithDependencies.id, replacementAccountId)}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Substituir e Migrar Tudo
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty States */}
      {activeTab === 'accounts' && accounts.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma conta cadastrada</h3>
            <p className="text-muted-foreground mb-4">
              Comece criando sua primeira conta bancária
            </p>
            <Button onClick={() => setShowAddAccount(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeira Conta
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab === 'transactions' && transactions.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma transação registrada</h3>
            <p className="text-muted-foreground mb-4">
              Registre receitas e despesas para controlar seu fluxo de caixa
            </p>
            <Button onClick={() => setShowAddTransaction(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeira Transação
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab === 'payables' && <ContasAPagar />}
      {activeTab === 'receivables' && <ContasAReceber />}
      {activeTab === 'dre' && <RelatorioDRE />}
      {activeTab === 'cash-flow' && <RelatorioFluxoCaixa />}

      {/* Modal Informativo do Plano de Contas */}
      {showChartInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999] overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col my-8">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-xl sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 leading-none mb-1">O que é o Plano de Contas?</h2>
                  <p className="text-sm text-slate-500">Entenda como organizar sua estrutura financeira</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowChartInfo(false)} className="rounded-full">
                <Plus className="w-5 h-5 rotate-45 text-slate-400" />
              </Button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="space-y-6">
                <section>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Conceito Fundamental</h3>
                  <p className="text-slate-600 leading-relaxed">
                    O Plano de Contas é o "mapa" financeiro da sua empresa. Ele define como cada centavo que entra ou sai será classificado. Sem uma boa estrutura, é impossível saber se você está tendo lucro real ou onde estão os maiores gastos.
                  </p>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg">
                    <h4 className="font-bold text-emerald-800 flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4" /> Receitas (Nível 4)
                    </h4>
                    <p className="text-sm text-emerald-700 mb-3">Tudo o que gera entrada de dinheiro.</p>
                    <ul className="text-xs space-y-1 text-emerald-900 font-mono bg-white/50 p-2 rounded">
                      <li>4.1 Vendas de Produtos</li>
                      <li>4.2 Prestação de Serviços</li>
                      <li>4.3 Receitas Financeiras</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-lg">
                    <h4 className="font-bold text-rose-800 flex items-center gap-2 mb-2">
                      <TrendingDown className="w-4 h-4" /> Custos e Despesas
                    </h4>
                    <p className="text-sm text-rose-700 mb-3">Saída de recursos para operação.</p>
                    <ul className="text-xs space-y-1 text-rose-900 font-mono bg-white/50 p-2 rounded">
                      <li className="font-bold">3 CUSTOS VARIÁVEIS</li>
                      <li className="ml-3">3.1 Insumos e Materiais</li>
                      <li className="font-bold mt-1">5 DESPESAS FIXAS</li>
                      <li className="ml-3">5.1 Aluguel e Energia</li>
                      <li className="ml-3">5.2 Folha de Pagamento</li>
                    </ul>
                  </div>
                </div>

                <section className="bg-slate-50 p-4 rounded-lg border">
                  <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Como a Hierarquia Funciona (Níveis)
                  </h3>
                  <div className="space-y-2 font-mono text-sm border-l-2 border-primary/20 ml-2 pl-4">
                    <div className="flex items-center gap-2">
                      <span className="text-primary font-bold">1</span>
                      <span className="text-slate-500">- ATIVO (Seu Patrimônio)</span>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <span className="text-primary font-bold text-xs">1.1</span>
                      <span className="text-slate-500 text-xs">- ATIVO CIRCULANTE (Dinheiro rápido)</span>
                    </div>
                    <div className="flex items-center gap-2 ml-8">
                      <span className="text-primary font-bold text-[10px]">1.1.01</span>
                      <span className="text-slate-500 text-[10px]">- CAIXA E BANCOS (Saldo atual)</span>
                    </div>
                  </div>
                </section>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800 italic">
                    <strong>Dica de Ouro:</strong> Vincule seus produtos às categorias corretas no cadastro de produtos. Assim, o sistema alimentará este plano de contas automaticamente a cada pedido!
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-slate-50 rounded-b-xl flex justify-end sticky bottom-0 z-10">
              <Button onClick={() => setShowChartInfo(false)} className="px-8 bg-primary hover:bg-primary/90 text-white">
                Entendi!
              </Button>
            </div>
          </div>
        </div>
      )}
      {showDefaultCategoriesModal && (
        <DefaultCategoriesModal 
          onClose={() => setShowDefaultCategoriesModal(false)}
          onSuccess={() => {
            setShowDefaultCategoriesModal(false);
            loadData();
          }}
        />
      )}
      {showDefaultChartModal && (
        <DefaultChartOfAccountsModal
          onClose={() => setShowDefaultChartModal(false)}
          onSuccess={() => {
            setShowDefaultChartModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
};

export default Financeiro;