import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { PermissionType } from '@/lib/permissions';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Package,
  Layers,
  FileText,
  ShoppingCart,
  BarChart3,
  Settings,
  Warehouse,
  Factory,
  DollarSign,
  TrendingUp
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
}

interface MenuItem {
  title: string;
  href: string;
  icon: any;
  alwaysVisible?: boolean;
  permission?: PermissionType;
}

// Definir todos os itens de menu possíveis
const allMenuItems: MenuItem[] = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    alwaysVisible: true
  },
  {
    title: 'Clientes',
    href: '/clientes',
    icon: Users,
    alwaysVisible: true
  },
  {
    title: 'Funcionários',
    href: '/funcionarios',
    icon: UserCheck,
    permission: 'admin.users'
  },
  {
    title: 'Produtos',
    href: '/produtos',
    icon: Package,
    alwaysVisible: true
  },
  {
    title: 'Materiais',
    href: '/materiais',
    icon: Layers,
    permission: 'inventory.view'
  },
  {
    title: 'Orçamentos',
    href: '/orcamentos',
    icon: FileText,
    alwaysVisible: true
  },
  {
    title: 'Pedidos',
    href: '/pedidos',
    icon: ShoppingCart,
    alwaysVisible: true
  },
  {
    title: 'Estoque',
    href: '/estoque',
    icon: Warehouse,
    permission: 'inventory.view'
  },
  {
    title: 'Produção',
    href: '/producao',
    icon: Factory,
    permission: 'production.view'
  },
  {
    title: 'Financeiro',
    href: '/financeiro',
    icon: DollarSign,
    permission: 'finance.view'
  },
  {
    title: 'A Receber',
    href: '/financeiro?tab=receivables',
    icon: DollarSign,
    permission: 'finance.view'
  },
  {
    title: 'DRE',
    href: '/financeiro?tab=dre',
    icon: BarChart3,
    permission: 'finance.reports'
  },
  {
    title: 'Fluxo de Caixa',
    href: '/financeiro?tab=cash-flow',
    icon: TrendingUp,
    permission: 'finance.reports'
  },
  {
    title: 'Relatórios',
    href: '/relatorios',
    icon: BarChart3,
    permission: 'finance.reports'
  },
  {
    title: 'Configurações',
    href: '/configuracoes',
    icon: Settings,
    permission: 'admin.settings'
  }
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
  const location = useLocation();
  const { hasPermission } = useAuth();

  // Filtrar itens do menu baseado nas permissões
  const getVisibleMenuItems = () => {
    return allMenuItems.filter(item => {
      if (item.alwaysVisible) return true;
      if (item.permission) return hasPermission(item.permission);
      return false;
    });
  };

  const visibleMenuItems = getVisibleMenuItems();

  return (
    <div className={cn(
      "bg-card border-r border-border transition-all duration-300 flex flex-col",
      isOpen ? "w-64" : "w-16"
    )}>
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">A</span>
          </div>
          {isOpen && (
            <div>
              <h1 className="font-bold text-lg text-foreground">ArtPlim</h1>
              <p className="text-xs text-muted-foreground">ERP Gráfico</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto min-h-0">
        <ul className="space-y-2">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;

            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {isOpen && (
                    <span className="font-medium">{item.title}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      {isOpen && (
        <div className="p-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            <p>ArtPlim ERP v1.0</p>
            <p>© 2024 Todos os direitos reservados</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;