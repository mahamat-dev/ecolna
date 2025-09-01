import { NavLink, useLocation } from 'react-router-dom';
import { useMe } from '@/hooks/useMe';
import { useTranslation } from 'react-i18next';
import { useSidebar } from '@/hooks/useSidebar';
import { useState } from 'react';
import {
  GridIcon,
  UserCircleIcon,
  BookOpenIcon,
  GraduationCapIcon,
  ClipboardListIcon,
  CheckSquareIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MenuIcon
} from '@/icons';

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; labelKey: string }[];
  labelKey: string;
};

export function Sidebar() {
  const { data } = useMe();
  const { t } = useTranslation();
  const location = useLocation();
  const { isExpanded, isMobileOpen, setIsHovered, toggleMobileSidebar } = useSidebar();
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const roles = data?.roles || [];

  const adminNavItems: NavItem[] = [
    {
      icon: <GridIcon />,
      name: t('menu.dashboard'),
      labelKey: 'menu.dashboard',
      path: '/'
    },
    {
      icon: <UserCircleIcon />,
      name: t('menu.profile'),
      labelKey: 'menu.profile',
      path: '/profile'
    },
    {
      icon: <UserCircleIcon />,
      name: t('menu.identity'),
      labelKey: 'menu.identity',
      subItems: [
        { name: t('menu.users'), path: '/identity/users', labelKey: 'menu.users' }
      ]
    },
    {
      icon: <BookOpenIcon />,
      name: t('menu.academics'),
      labelKey: 'menu.academics',
      subItems: [
        { name: t('menu.stages'), path: '/academics/stages', labelKey: 'menu.stages' },
        { name: t('menu.gradeLevels'), path: '/academics/grade-levels', labelKey: 'menu.gradeLevels' },
        { name: t('menu.subjects'), path: '/academics/subjects', labelKey: 'menu.subjects' },
        { name: t('menu.sections'), path: '/academics/sections', labelKey: 'menu.sections' }
      ]
    },
    {
      icon: <GraduationCapIcon />,
      name: t('menu.enrollment'),
      labelKey: 'menu.enrollment',
      subItems: [
        { name: t('menu.enrollment'), path: '/enrollment', labelKey: 'menu.enrollment' },
        { name: t('menu.guardians'), path: '/enrollment/guardians', labelKey: 'menu.guardians' }
      ]
    },
    {
      icon: <ClipboardListIcon />,
      name: t('menu.teaching'),
      labelKey: 'menu.teaching',
      subItems: [
        { name: t('menu.assignments'), path: '/teaching/assignments', labelKey: 'menu.assignments' }
      ]
    },
    {
      icon: <CheckSquareIcon />,
      name: t('menu.attendance'),
      labelKey: 'menu.attendance',
      subItems: [
        { name: t('menu.attendance'), path: '/attendance/sessions', labelKey: 'menu.attendance' },
        { name: t('menu.takeAttendance'), path: '/attendance/take', labelKey: 'menu.takeAttendance' }
      ]
    }
  ];

  const staffNavItems: NavItem[] = [
    {
      icon: <GridIcon />,
      name: t('menu.dashboard'),
      labelKey: 'menu.dashboard',
      path: '/'
    },
    {
       icon: <UserCircleIcon />,
       name: t('menu.profile'),
       labelKey: 'menu.profile',
       path: '/profile'
     },
    {
      icon: <GraduationCapIcon />,
      name: t('menu.enrollment'),
      labelKey: 'menu.enrollment',
      subItems: [
        { name: t('menu.enrollment'), path: '/enrollment', labelKey: 'menu.enrollment' },
        { name: t('menu.guardians'), path: '/enrollment/guardians', labelKey: 'menu.guardians' }
      ]
    },
    {
      icon: <CheckSquareIcon />,
      name: t('menu.attendance'),
      labelKey: 'menu.attendance',
      subItems: [
        { name: t('menu.attendance'), path: '/attendance/sessions', labelKey: 'menu.attendance' },
        { name: t('menu.takeAttendance'), path: '/attendance/take', labelKey: 'menu.takeAttendance' }
      ]
    }
  ];

  const navItems = roles.includes('ADMIN') ? adminNavItems : staffNavItems;

  const toggleSubmenu = (itemName: string) => {
    setOpenSubmenu(prev => prev === itemName ? null : itemName);
  };

  const isItemActive = (item: NavItem) => {
    if (item.path) {
      return location.pathname === item.path;
    }
    if (item.subItems) {
      return item.subItems.some(subItem => location.pathname === subItem.path);
    }
    return false;
  };

  const isSubItemActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <aside
      className={`fixed left-0 top-0 z-50 h-screen bg-white border-r border-gray-200 transition-all duration-300 ease-in-out dark:bg-gray-900 dark:border-gray-800 ${
        isExpanded ? 'w-[290px]' : 'w-[90px]'
      } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => !isExpanded && setIsHovered(false)}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800">
          <div className={`flex items-center gap-3 transition-opacity duration-300 ${
            isExpanded ? 'opacity-100' : 'opacity-0'
          }`}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <span className="text-sm font-bold">E</span>
            </div>
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('app.title')}
            </span>
          </div>
          <button
            onClick={toggleMobileSidebar}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <MenuIcon />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-6">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const hasSubItems = item.subItems && item.subItems.length > 0;
              const isActive = isItemActive(item);
              const isOpen = openSubmenu === item.name;

              return (
                <li key={item.name}>
                  {item.path ? (
                    <NavLink
                      to={item.path}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className="flex h-5 w-5 items-center justify-center">
                        {item.icon}
                      </span>
                      <span className={`transition-opacity duration-300 ${
                        isExpanded ? 'opacity-100' : 'opacity-0'
                      }`}>
                        {item.name}
                      </span>
                    </NavLink>
                  ) : (
                    <button
                      onClick={() => hasSubItems && toggleSubmenu(item.name)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className="flex h-5 w-5 items-center justify-center">
                        {item.icon}
                      </span>
                      <span className={`flex-1 text-left transition-opacity duration-300 ${
                        isExpanded ? 'opacity-100' : 'opacity-0'
                      }`}>
                        {item.name}
                      </span>
                      {hasSubItems && isExpanded && (
                        <span className="transition-transform duration-200">
                          {isOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
                        </span>
                      )}
                    </button>
                  )}

                  {/* Submenu */}
                  {hasSubItems && isOpen && isExpanded && (
                    <ul className="mt-2 space-y-1 pl-8">
                      {item.subItems!.map((subItem) => (
                        <li key={subItem.path}>
                          <NavLink
                            to={subItem.path}
                            className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                              isSubItemActive(subItem.path)
                                ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400'
                                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                            }`}
                          >
                            {subItem.name}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 dark:border-gray-800">
          <div className={`text-xs text-gray-500 transition-opacity duration-300 ${
            isExpanded ? 'opacity-100' : 'opacity-0'
          }`}>
            v1.0.0
          </div>
        </div>
      </div>
    </aside>
  );
}