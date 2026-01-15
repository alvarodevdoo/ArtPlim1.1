import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  Menu,
  Bell,
  Search,
  User,
  LogOut,
  Settings
} from 'lucide-react';

interface TopbarProps {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}

const Topbar: React.FC<TopbarProps> = ({ onToggleSidebar, sidebarOpen }) => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar..."
              className="pl-10 pr-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent w-64"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <button className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
              3
            </span>
          </button>

          {/* User menu */}
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.organizationName}</p>
            </div>
            
            <div className="relative group">
              <button className="flex items-center space-x-2 p-2 rounded-lg hover:bg-accent transition-colors">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
              </button>

              {/* Dropdown menu */}
              <div className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="py-2">
                  <button className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-popover-foreground hover:bg-accent transition-colors">
                    <User className="w-4 h-4" />
                    <span>Perfil</span>
                  </button>
                  <button className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-popover-foreground hover:bg-accent transition-colors">
                    <Settings className="w-4 h-4" />
                    <span>Configurações</span>
                  </button>
                  <hr className="my-2 border-border" />
                  <button 
                    onClick={logout}
                    className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-destructive hover:bg-accent transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sair</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;