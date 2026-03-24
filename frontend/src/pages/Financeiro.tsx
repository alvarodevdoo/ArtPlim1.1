import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  Plus,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Wallet,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Activity,
  RefreshCw,
  Trash,
  UserCheck,
  Users
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import { ContasAPagar } from '../features/financeiro/ContasAPagar';
import { ContasAReceber } from '../features/financeiro/ContasAReceber';
import { RelatorioDRE } from '../features/financeiro/RelatorioDRE';
import { RelatorioFluxoCaixa } from '../features/financeiro/RelatorioFluxoCaixa';

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
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('30'); // dias

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
    type: 'EXPENSE',
    color: '#EF4444'
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
      const [accountsResponse, transactionsResponse, dashboardResponse, categoriesResponse, profilesResponse] = await Promise.all([
        api.get('/api/finance/accounts'),
        api.get(`/api/finance/transactions?limit=50`),
        api.get(`/api/finance/dashboard?days=${dateRange}`),
        api.get('/api/finance/categories'),
        api.get('/api/profiles')
      ]);

      setAccounts(accountsResponse.data.data);
      setTransactions(transactionsResponse.data.data);
      setDashboard(dashboardResponse.data.data);
      setCategories(categoriesResponse.data.data);
      setProfiles(profilesResponse.data.data);
    } catch (error) {
      toast.error('Erro ao carregar dados financeiros');
    } finally {
      setLoading(false);
    }
  };

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
    try {
      await api.post('/api/finance/categories', categoryForm);
      toast.success('Categoria criada!');
      setShowAddCategory(false);
      setCategoryForm({ name: '', type: 'EXPENSE', color: '#EF4444' });
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao criar categoria');
    }
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

  const initializeDefaultCategories = async () => {
    try {
      await api.post('/api/finance/categories/default');
      toast.success('Categorias padrão criadas com sucesso!');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Erro ao criar categorias padrão');
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
          {categories.length === 0 && (
            <Button variant="outline" onClick={initializeDefaultCategories}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Categorias
            </Button>
          )}
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
            { id: 'categories', label: 'Categorias' },
            { id: 'transactions', label: 'Transações' },
            { id: 'receivables', label: 'A Receber' },
            { id: 'payables', label: 'A Pagar' },
            { id: 'dre', label: 'DRE' },
            { id: 'cash-flow', label: 'Fluxo de Caixa' },
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
                    <Button size="sm" variant="outline" onClick={() => handleEditAccount(account)}>
                      Editar
                    </Button>
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
              <h2 className="text-xl font-semibold">Gerenciar Categorias</h2>
              <p className="text-sm text-muted-foreground">Classifique seus lançamentos</p>
            </div>
            <Button onClick={() => setShowAddCategory(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Categoria
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-green-600 flex items-center gap-2"><TrendingUp className="w-5 h-5"/> Receitas</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                 {categories.filter(c => c.type === 'INCOME').length === 0 && <p className="text-sm text-muted-foreground">Nenhuma categoria encontrada.</p>}
                 {categories.filter(c => c.type === 'INCOME').map(c => (
                   <div key={c.id} className="flex justify-between items-center p-3 text-sm border rounded hover:bg-slate-50">
                     <div className="flex items-center gap-3">
                       <div className="w-4 h-4 rounded-full" style={{ backgroundColor: c.color || '#10B981' }} />
                       <span className="font-medium">{c.name}</span>
                     </div>
                     <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(c.id)}>
                        <Trash className="w-4 h-4 text-slate-400 hover:text-red-500" />
                     </Button>
                   </div>
                 ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-red-600 flex items-center gap-2"><TrendingDown className="w-5 h-5"/> Despesas</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                 {categories.filter(c => c.type === 'EXPENSE').length === 0 && <p className="text-sm text-muted-foreground">Nenhuma categoria encontrada.</p>}
                 {categories.filter(c => c.type === 'EXPENSE').map(c => (
                   <div key={c.id} className="flex justify-between items-center p-3 text-sm border rounded hover:bg-slate-50">
                     <div className="flex items-center gap-3">
                       <div className="w-4 h-4 rounded-full" style={{ backgroundColor: c.color || '#EF4444' }} />
                       <span className="font-medium">{c.name}</span>
                     </div>
                     <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(c.id)}>
                        <Trash className="w-4 h-4 text-slate-400 hover:text-red-500" />
                     </Button>
                   </div>
                 ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {transactions.map((transaction) => {
            const statusInfo = transactionStatusConfig[transaction.status];
            const StatusIcon = statusInfo.icon;

            return (
              <Card key={transaction.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-full ${transaction.type === 'INCOME' ? 'bg-green-100' : 'bg-red-100'
                        }`}>
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
                        <p className={`font-semibold ${transaction.type === 'INCOME' ? 'text-green-600' : 'text-red-600'
                          }`}>
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
          })}
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
              <CardTitle>Nova Categoria</CardTitle>
              <CardDescription>Crie uma classificação para suas transações</CardDescription>
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

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="ghost" onClick={() => setShowAddCategory(false)}>Cancelar</Button>
                  <Button type="submit">Salvar</Button>
                </div>
              </form>
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
    </div>
  );
};

export default Financeiro;