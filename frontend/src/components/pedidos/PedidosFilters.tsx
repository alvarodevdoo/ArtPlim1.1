import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Search, TrendingUp, TrendingDown } from 'lucide-react';
import { statusConfig } from '@/types/pedidos';

interface PedidosFiltersProps {
  searchInput: string;
  setSearchInput: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  dateFilter: string;
  setDateFilter: (v: string) => void;
  sortBy: 'date' | 'value' | 'customer';
  setSortBy: (v: 'date' | 'value' | 'customer') => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (v: 'asc' | 'desc') => void;
}

const PedidosFilters: React.FC<PedidosFiltersProps> = React.memo(({
  searchInput, setSearchInput,
  statusFilter, setStatusFilter,
  dateFilter, setDateFilter,
  sortBy, setSortBy,
  sortOrder, setSortOrder,
}) => {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[300px] space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Buscar Pedido</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Número, cliente ou telefone..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 h-10 border-muted-foreground/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div className="w-48 space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-10 px-3 border border-muted-foreground/20 rounded-md bg-background text-sm outline-none transition-all"
            >
              <option value="">Todos</option>
              {Object.entries(statusConfig).map(([status, config]) => (
                <option key={status} value={status}>{config.label}</option>
              ))}
            </select>
          </div>

          <div className="w-44 space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Data</label>
            <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="h-10 border-muted-foreground/20" />
          </div>

          <div className="flex items-center space-x-2 pb-0.5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Ordem</label>
              <div className="flex items-center space-x-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="h-10 px-3 border border-muted-foreground/20 rounded-md bg-background text-sm outline-none"
                >
                  <option value="date">Data</option>
                  <option value="value">Valor</option>
                  <option value="customer">Cliente</option>
                </select>
                <Button
                  variant="outline"
                  className="h-10 w-10 p-0 border-muted-foreground/20"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  {sortOrder === 'asc' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="pb-0.5">
            <Button
              variant="ghost"
              className="h-10 text-muted-foreground hover:text-destructive transition-colors"
              onClick={() => { setSearchInput(''); setStatusFilter(''); setDateFilter(''); setSortBy('date'); setSortOrder('desc'); }}
            >
              Limpar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

PedidosFilters.displayName = 'PedidosFilters';
export default PedidosFilters;
