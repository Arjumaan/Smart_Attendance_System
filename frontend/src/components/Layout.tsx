import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { User, TabType } from '../types';

interface LayoutProps {
  user: User | null;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabType>('kiosk');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentUser={user}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <Navbar
          activeTab={activeTab}
          currentUser={user}
          onLogout={onLogout}
          onToggleSidebar={() => setIsMobileOpen(!isMobileOpen)}
        />
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
