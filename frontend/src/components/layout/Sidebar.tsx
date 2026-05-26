import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizationBranding } from '@/hooks/useOrganizationBranding';
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
  Truck,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  ListChecks,
  ArrowLeftRight,
  CreditCard,
  Receipt
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

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

type NavEntry = MenuItem | { separator: true; label: string };

const menuGroups: MenuGroup[] = [
  {
    label: '',
    items: [
      {
        title: 'Dashboard',
        href: '/',
        icon: LayoutDashboard,
        alwaysVisible: true
      }
    ]
  },
  {
    label: 'Vendas',
    items: [
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
        title: 'Pendências',
        href: '/pendencias',
        icon: ListChecks,
        permission: 'sales.edit_price'
      }
    ]
  },
  {
    label: 'Operações',
    items: [
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
        title: 'Estoque',
        href: '/estoque',
        icon: Warehouse,
        permission: 'inventory.view'
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
      }
    ]
  },
  {
    label: 'Cadastros',
    items: [
      {
        title: 'Produtos',
        href: '/produtos',
        icon: Package,
        alwaysVisible: true
      },
      {
        title: 'Clientes',
        href: '/clientes',
        icon: Users,
        alwaysVisible: true
      },
      {
        title: 'Fornecedores',
        href: '/fornecedores',
        icon: Truck,
        alwaysVisible: true
      },
      {
        title: 'Funcionários',
        href: '/funcionarios',
        icon: UserCheck,
        permission: 'admin.users'
      }
    ]
  },
  {
    label: 'Gestão',
    items: [
      {
        title: 'Financeiro',
        href: '/financeiro?tab=dashboard',
        icon: DollarSign,
        permission: 'finance.view',
        subItems: [
          {
            title: 'Dashboard',
            href: '/financeiro?tab=dashboard',
            icon: LayoutDashboard,
            permission: 'finance.view'
          },
          {
            title: 'A Receber',
            href: '/financeiro?tab=receivables',
            icon: TrendingUp,
            permission: 'finance.view'
          },
          {
            title: 'A Pagar',
            href: '/financeiro?tab=payables',
            icon: TrendingDown,
            permission: 'finance.view'
          },
          {
            title: 'Transações',
            href: '/financeiro?tab=transactions',
            icon: ArrowLeftRight,
            permission: 'finance.view'
          },
          {
            title: 'Contas',
            href: '/financeiro?tab=accounts',
            icon: CreditCard,
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
            title: 'Categorias',
            href: '/financeiro?tab=categories',
            icon: Receipt,
            permission: 'finance.view'
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
    ]
  }
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
  const location = useLocation();
  const { hasPermission } = useAuth();
  const branding = useOrganizationBranding();

  const [expandedMenu, setExpandedMenu] = React.useState<string | null>(null);

  const toggleMenu = (title: string) => {
    setExpandedMenu(prev => (prev === title ? null : title));
  };

  const isItemVisible = (item: MenuItem) => {
    if (item.alwaysVisible) return true;
    if (item.permission) return hasPermission(item.permission);
    return false;
  };

  const renderMenuItem = (item: MenuItem) => {
    const Icon = item.icon;
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isExpanded = expandedMenu === item.title;
    const isActive = location.pathname === item.href && !hasSubItems;

    return (
      <li key={item.title}>
        {hasSubItems ? (
          <div className="space-y-1">
            <div className={cn('flex items-center rounded-lg transition-all duration-200 h-10', !isOpen && 'justify-center')}>
              <Link
                to={item.href}
                onClick={() => { if (expandedMenu !== item.title) toggleMenu(item.title); }}
                className={cn(
                  'flex items-center flex-1 h-full px-3 rounded-lg transition-colors focus:outline-none',
                  location.pathname === item.href
                    ? 'text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                  !isOpen && 'justify-center'
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {isOpen && <span className="ml-3 font-medium flex-1 text-sm">{item.title}</span>}
              </Link>
              {isOpen && (
                <button
                  onClick={() => toggleMenu(item.title)}
                  className="h-full px-2 text-muted-foreground hover:text-foreground focus:outline-none"
                >
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 opacity-50" />
                    : <ChevronRight className="w-4 h-4 opacity-50" />}
                </button>
              )}
            </div>
            {isOpen && isExpanded && (
              <ul className="ml-4 pl-4 border-l border-border/60 space-y-1 mt-1">
                {item.subItems!.map(sub => {
                  const SubIcon = sub.icon;
                  const isSubActive = location.pathname + location.search === sub.href;
                  return (
                    <li key={sub.title}>
                      <Link
                        to={sub.href}
                        className={cn(
                          'flex items-center rounded-md h-9 px-3 transition-colors text-xs',
                          isSubActive
                            ? 'bg-primary/10 text-primary font-bold'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
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
              'flex items-center rounded-lg transition-all duration-200 h-10 px-3',
              isOpen ? 'w-full' : 'justify-center px-0 w-10 mx-auto',
              isActive
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 font-bold'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
            title={!isOpen ? item.title : undefined}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {isOpen && (
              <span className="ml-3 font-medium text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                {item.title}
              </span>
            )}
          </Link>
        )}
      </li>
    );
  };

  return (
    <div className={cn(
      'bg-card border-r border-border transition-all duration-300 flex flex-col',
      isOpen ? 'w-64' : 'w-16'
    )}>
      {/* Logo */}
      <div className={cn('p-4 border-b border-border transition-all', !isOpen && 'flex justify-center')}>
        {isOpen && branding?.logoFull ? (
          <div className="flex items-center justify-center w-full">
            <img
              src={branding.logoFull}
              alt={branding.name || 'Logo'}
              className="max-h-12 max-w-full object-contain"
            />
          </div>
        ) : !isOpen && (branding?.logoIcon || branding?.logoFull) ? (
          <div className="w-8 h-8 flex items-center justify-center shrink-0">
            <img
              src={branding.logoIcon || branding.logoFull!}
              alt={branding.name || 'Logo'}
              className="max-h-8 max-w-8 object-contain"
            />
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
              <span className="text-primary-foreground font-bold text-sm">
                {(branding?.name || 'A').charAt(0).toUpperCase()}
              </span>
            </div>
            {isOpen && (
              <div className="transition-all duration-300 transform origin-left">
                <h1 className="font-bold text-lg text-foreground leading-tight">
                  {branding?.name || 'ArtPlim'}
                </h1>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">ERP Gráfico</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto min-h-0 custom-scrollbar">
        <div className="space-y-4">
          {menuGroups.map((group) => {
            const visibleItems = group.items.filter(isItemVisible);
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label || '__top'}>
                {isOpen && group.label && (
                  <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
                    {group.label}
                  </p>
                )}
                {!isOpen && group.label && (
                  <div className="mx-auto w-6 border-t border-border/40 my-1" />
                )}
                <ul className="space-y-1">
                  {visibleItems.map(renderMenuItem)}
                </ul>
              </div>
            );
          })}
        </div>
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
