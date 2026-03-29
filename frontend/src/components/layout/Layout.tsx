import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - Fixo, não recarrega */}
      <Sidebar isOpen={sidebarOpen} />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar - Fixo, não recarrega */}
        <Topbar onToggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />
        
        {/* Page Content - Área que muda conforme a rota */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-background p-6">
          <div className="container mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;