import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/shell/Sidebar';
import { Header } from '@/shell/Header';
import { SearchDialog } from '@/shell/SearchDialog';
import { Backdrop } from '@/shell/Backdrop';
import { SidebarProvider } from '@/contexts/SidebarContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useSidebar } from '@/hooks/useSidebar';
import { useState } from 'react';

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="min-h-screen xl:flex">
      <div>
        <Sidebar />
        <Backdrop />
      </div>
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isExpanded || isHovered ? "lg:ml-[290px]" : "lg:ml-[90px]"
        } ${isMobileOpen ? "ml-0" : ""}`}
      >
        <Header onSearch={() => setSearchOpen(true)} />
        <div className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6">
          <Outlet />
        </div>
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
};

export function AppShell() {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <LayoutContent />
      </SidebarProvider>
    </ThemeProvider>
  );
}