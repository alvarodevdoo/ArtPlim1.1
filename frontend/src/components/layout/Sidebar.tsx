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
  TrendingUp,
  ChevronDown,
  ChevronRight,
  ListChecks
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
  subItems?: MenuItem[];
}

// Definir todos os itens de menu possíveis com hierarquia
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
    title: 'Insumos',
    href: '/insumos',
    icon: Layers,
    permission: 'inventory.view'
  },
  {
    title: 'Entrada NF-e',
    href: '/entrada-nfe',
    icon: FileText,
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
    permission: 'production.view',
    subItems: [
      {
        title: 'Painel Central',
        href: '/producao',
        icon: LayoutDashboard,
        permission: 'production.view'
      },
      {
        title: 'Terminal do Operador',
        href: '/producao/terminal',
        icon: ListChecks,
        permission: 'production.view'
      }
    ]
  },
  {
    title: 'Financeiro',
    href: '/financeiro',
    icon: DollarSign,
    permission: 'finance.view',
    subItems: [
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
      }
    ]
  },
  {
    title: 'Relatórios',
    href: '/relatorios',
    icon: BarChart3,
    permission: 'finance.reports',
    subItems: [
      {
        title: 'Visão Geral',
        href: '/relatorios',
        icon: FileText,
        permission: 'finance.reports'
      },
      {
        title: 'Lucratividade Real',
        href: '/lucratividade',
        icon: TrendingUp,
        permission: 'finance.reports'
      }
    ]
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
  
  // Estado para controlar quais menus estão expandidos
  const [expandedMenus, setExpandedMenus] = React.useState<Record<string, boolean>>({
    'Financeiro': true // Inicia financeiro aberto se desejar
  });

  const toggleMenu = (title: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

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
      <div className={cn("p-4 border-b border-border transition-all", !isOpen && "flex justify-center")}>
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-sm">A</span>
          </div>
          {isOpen && (
            <div className="transition-all duration-300 transform origin-left">
              <h1 className="font-bold text-lg text-foreground leading-tight">ArtPlim</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">ERP Gráfico</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto min-h-0 custom-scrollbar">
        <ul className="space-y-1.5 focus:outline-none">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const hasSubItems = item.subItems && item.subItems.length > 0;
            const isExpanded = expandedMenus[item.title];
            const isActive = location.pathname === item.href && !hasSubItems;

            return (
              <li key={item.title}>
                {hasSubItems ? (
                  <div className="space-y-1">
                    <button
                      onClick={() => toggleMenu(item.title)}
                      className={cn(
                        "flex items-center rounded-lg transition-all duration-200 h-10 px-3 w-full text-left",
                        "text-muted-foreground hover:text-foreground hover:bg-accent focus:outline-none",
                        !isOpen && "justify-center"
                      )}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {isOpen && (
                        <>
                          <span className="ml-3 font-medium flex-1 text-sm">{item.title}</span>
                          {isExpanded ? <ChevronDown className="w-4 h-4 opacity-50" /> : <ChevronRight className="w-4 h-4 opacity-50" />}
                        </>
                      )}
                    </button>
                    {isOpen && isExpanded && (
                      <ul className="ml-4 pl-4 border-l border-border/60 space-y-1 mt-1 transition-all">
                        {item.subItems!.map(sub => {
                          const SubIcon = sub.icon;
                          const isSubActive = location.pathname + location.search === sub.href;
                          
                          return (
                            <li key={sub.title}>
                              <Link
                                to={sub.href}
                                className={cn(
                                  "flex items-center rounded-md h-9 px-3 transition-colors text-xs",
                                  isSubActive
                                    ? "bg-primary/10 text-primary font-bold"
                                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                                )}
                              >
                                <SubIcon className="w-4 h-4 mr-2.5 opacity-70" />
                                <span>{sub.title}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : (
                  <Link
                    to={item.href}
                    className={cn(
                      "flex items-center rounded-lg transition-all duration-200 h-10 px-3",
                      isOpen ? "w-full" : "justify-center px-0 w-10 mx-auto",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                    title={!isOpen ? item.title : undefined}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {isOpen && (
                      <span className="ml-3 font-medium text-sm whitespace-nowrap overflow-hidden text-ellipsis">{item.title}</span>
                    )}
                  </Link>
                )}
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