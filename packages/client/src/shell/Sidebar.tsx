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
  HistoryIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MenuIcon,
  FileTextIcon
} from '@/icons';
import { Shield, DollarSign, MessageSquare } from 'lucide-react';

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
  const { isExpanded, setIsHovered, toggleMobileSidebar } = useSidebar();
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
    },
    {
      icon: <FileTextIcon />,
      name: t('menu.content'),
      labelKey: 'menu.content',
      subItems: [
        { name: t('menu.notes'), path: '/content/notes', labelKey: 'menu.notes' }
      ]
    },
    {
      icon: <ClipboardListIcon />,
      name: t('menu.assess'),
      labelKey: 'menu.assess',
      subItems: [
        { name: t('menu.quizzes'), path: '/teacher/assess', labelKey: 'menu.quizzes' },
        { name: t('menu.questionBank'), path: '/teacher/assess/questions', labelKey: 'menu.questionBank' }
      ]
    },
    {
      icon: <Shield className="w-5 h-5" />,
      name: t('menu.discipline'),
      labelKey: 'menu.discipline',
      subItems: [
        { name: t('menu.incidents'), path: '/discipline/incidents', labelKey: 'menu.incidents' },
        { name: t('menu.categories'), path: '/discipline/categories', labelKey: 'menu.categories' },
        { name: t('menu.detention'), path: '/discipline/detention', labelKey: 'menu.detention' }
      ]
    },
    {
      icon: <DollarSign className="w-5 h-5" />,
      name: t('menu.finance'),
      labelKey: 'menu.finance',
      subItems: [
        { name: t('menu.feeSchedules') ?? 'Barèmes', path: '/finance/fees/schedules', labelKey: 'menu.feeSchedules' },
        { name: t('menu.feeAssign') ?? 'Affectations', path: '/finance/fees/assign', labelKey: 'menu.feeAssign' },
        { name: t('menu.invoices'), path: '/finance/invoices', labelKey: 'menu.invoices' },
        { name: t('menu.payments'), path: '/finance/payments', labelKey: 'menu.payments' },
        { name: t('menu.advancesAdmin') ?? 'Avances (admin)', path: '/finance/advances/admin', labelKey: 'menu.advancesAdmin' },
        { name: t('menu.payroll'), path: '/finance/payroll', labelKey: 'menu.payroll' }
      ]
    },
    {
      icon: <MessageSquare className="w-5 h-5" />,
      name: t('menu.messages'),
      labelKey: 'menu.messages',
      subItems: [
        { name: t('menu.inbox'), path: '/messages', labelKey: 'menu.inbox' },
        { name: t('menu.compose'), path: '/messages/compose', labelKey: 'menu.compose' }
      ]
    },
    {
      icon: <HistoryIcon />,
      name: t('menu.audit'),
      labelKey: 'menu.audit',
      path: '/audit'
    }
  ];

  const staffNavItems: NavItem[] = [
    {
      icon: <GridIcon />,
      name: t('menu.dashboard'),
      labelKey: 'menu.dashboard',
      path: '/staff'
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
    },
    {
      icon: <FileTextIcon />,
      name: t('menu.content'),
      labelKey: 'menu.content',
      subItems: [
        { name: t('menu.notes'), path: '/content/notes', labelKey: 'menu.notes' }
      ]
    },
    {
      icon: <Shield className="w-5 h-5" />,
      name: t('menu.discipline'),
      labelKey: 'menu.discipline',
      subItems: [
        { name: t('menu.incidents'), path: '/discipline/incidents', labelKey: 'menu.incidents' },
        { name: t('menu.detention'), path: '/discipline/detention', labelKey: 'menu.detention' }
      ]
    },
    {
      icon: <DollarSign className="w-5 h-5" />,
      name: t('menu.finance'),
      labelKey: 'menu.finance',
      subItems: [
        { name: t('menu.feeSchedules') ?? 'Barèmes', path: '/finance/fees/schedules', labelKey: 'menu.feeSchedules' },
        { name: t('menu.feeAssign') ?? 'Affectations', path: '/finance/fees/assign', labelKey: 'menu.feeAssign' },
        { name: t('menu.invoices'), path: '/finance/invoices', labelKey: 'menu.invoices' },
        { name: t('menu.payments'), path: '/finance/payments', labelKey: 'menu.payments' },
        { name: t('menu.advancesAdmin') ?? 'Avances (admin)', path: '/finance/advances/admin', labelKey: 'menu.advancesAdmin' },
        { name: t('menu.payroll'), path: '/finance/payroll', labelKey: 'menu.payroll' }
      ]
    },
    {
      icon: <MessageSquare className="w-5 h-5" />,
      name: t('menu.messages'),
      labelKey: 'menu.messages',
      subItems: [
        { name: t('menu.inbox'), path: '/messages', labelKey: 'menu.inbox' },
        { name: t('menu.compose'), path: '/messages/compose', labelKey: 'menu.compose' }
      ]
    }
  ];

  const teacherNavItems: NavItem[] = [
    {
      icon: <GridIcon />,
      name: t('menu.dashboard'),
      labelKey: 'menu.dashboard',
      path: '/teacher'
    },
    {
      icon: <UserCircleIcon />,
      name: t('menu.profile'),
      labelKey: 'menu.profile',
      path: '/profile'
    },
    {
      icon: <ClipboardListIcon />,
      name: t('menu.assessTeacher'),
      labelKey: 'menu.assessTeacher',
      subItems: [
        { name: t('menu.quizzes'), path: '/teacher/assess', labelKey: 'menu.quizzes' },
        { name: t('menu.questionBank'), path: '/teacher/assess/questions', labelKey: 'menu.questionBank' }
      ]
    },
    {
      icon: <FileTextIcon />,
      name: t('menu.content'),
      labelKey: 'menu.content',
      subItems: [
        { name: t('menu.notes'), path: '/content/notes', labelKey: 'menu.notes' }
      ]
    },
    {
      icon: <Shield className="w-5 h-5" />,
      name: t('menu.discipline'),
      labelKey: 'menu.discipline',
      subItems: [
        { name: t('menu.incidents'), path: '/discipline/incidents', labelKey: 'menu.incidents' }
      ]
    },
    {
      icon: <DollarSign className="w-5 h-5" />,
      name: t('menu.finance'),
      labelKey: 'menu.finance',
      subItems: [
        { name: t('menu.advances') ?? 'Avances', path: '/finance/advances', labelKey: 'menu.advances' },
        { name: t('menu.myPayslips') ?? 'Mes fiches de paie', path: '/finance/me/payslips', labelKey: 'menu.myPayslips' }
      ]
    },
    {
      icon: <MessageSquare className="w-5 h-5" />,
      name: t('menu.messages'),
      labelKey: 'menu.messages',
      subItems: [
        { name: t('menu.inbox'), path: '/messages', labelKey: 'menu.inbox' },
        { name: t('menu.compose'), path: '/messages/compose', labelKey: 'menu.compose' }
      ]
    }
  ];

  const studentNavItems: NavItem[] = [
    {
      icon: <GridIcon />,
      name: t('menu.dashboard'),
      labelKey: 'menu.dashboard',
      path: '/student'
    },
    {
      icon: <UserCircleIcon />,
      name: t('menu.profile'),
      labelKey: 'menu.profile',
      path: '/profile'
    },
    {
      icon: <CheckSquareIcon />,
      name: t('menu.attendance'),
      labelKey: 'menu.attendance',
      path: '/student/attendance'
    },
    {
      icon: <ClipboardListIcon />,
      name: t('menu.assessStudent'),
      labelKey: 'menu.assessStudent',
      path: '/student/assess'
    },
    {
      icon: <FileTextIcon />,
      name: t('menu.content'),
      labelKey: 'menu.content',
      subItems: [
        { name: t('menu.notes'), path: '/student/notes', labelKey: 'menu.notes' }
      ]
    },
    {
      icon: <MessageSquare className="w-5 h-5" />,
      name: t('menu.messages'),
      labelKey: 'menu.messages',
      subItems: [
        { name: t('menu.inbox'), path: '/messages', labelKey: 'menu.inbox' },
        { name: t('menu.compose'), path: '/messages/compose', labelKey: 'menu.compose' }
      ]
    }
    ,
    {
      icon: <DollarSign className="w-5 h-5" />,
      name: t('menu.finance'),
      labelKey: 'menu.finance',
      subItems: [
        { name: t('menu.myInvoices') ?? 'Mes factures', path: '/finance/me/invoices', labelKey: 'menu.myInvoices' }
      ]
    }
  ];

  const guardianNavItems: NavItem[] = [
    {
      icon: <GridIcon />,
      name: t('menu.dashboard'),
      labelKey: 'menu.dashboard',
      path: '/guardian'
    },
    {
      icon: <UserCircleIcon />,
      name: t('menu.profile'),
      labelKey: 'menu.profile',
      path: '/profile'
    },
    {
      icon: <CheckSquareIcon />,
      name: t('menu.attendance'),
      labelKey: 'menu.attendance',
      path: '/guardian/attendance'
    },
    {
      icon: <FileTextIcon />,
      name: t('menu.content'),
      labelKey: 'menu.content',
      subItems: [
        { name: t('menu.notes'), path: '/guardian/notes', labelKey: 'menu.notes' }
      ]
    },
    {
      icon: <MessageSquare className="w-5 h-5" />,
      name: t('menu.messages'),
      labelKey: 'menu.messages',
      subItems: [
        { name: t('menu.inbox'), path: '/messages', labelKey: 'menu.inbox' },
        { name: t('menu.compose'), path: '/messages/compose', labelKey: 'menu.compose' }
      ]
    }
  ];

  const navItems = roles.includes('ADMIN')
    ? adminNavItems
    : roles.includes('TEACHER')
      ? teacherNavItems
      : roles.includes('GUARDIAN')
        ? guardianNavItems
        : roles.includes('STUDENT')
          ? studentNavItems
          : staffNavItems;

  const toggleSubmenu = (itemName: string) => {
    setOpenSubmenu(prev => prev === itemName ? null : itemName);
  };

  const isItemActive = (item: NavItem) => {
    if (item.path) {
      return location.pathname === item.path || location.pathname.startsWith(item.path + '/');
    }
    if (item.subItems) {
      return item.subItems.some(subItem =>
        location.pathname === subItem.path || location.pathname.startsWith(subItem.path + '/')
      );
    }
    return false;
  };

  const isSubItemActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <aside
      className={`fixed left-0 top-0 z-50 h-screen bg-white border-r border-gray-200 transition-all duration-300 ease-in-out dark:bg-gray-900 dark:border-gray-800 flex flex-col ${
        isExpanded ? 'w-[290px]' : 'w-[90px]'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800">
        <button className="lg:hidden" onClick={toggleMobileSidebar}>
          <MenuIcon />
        </button>
        <span className="text-xl font-semibold">Ecolna</span>
      </div>

      <nav className="mt-4 flex-1 overflow-y-auto px-2">
        {navItems.map((item) => (
          <div key={item.labelKey}>
            {item.subItems ? (
              <div className={`px-2 py-2 cursor-pointer flex items-center justify-between ${isItemActive(item) ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
                   onClick={() => toggleSubmenu(item.name)}>
                <div className="flex items-center gap-3">
                  {item.icon}
                  {isExpanded && <span>{item.name}</span>}
                </div>
                {isExpanded && (
                  openSubmenu === item.name ? <ChevronDownIcon /> : <ChevronRightIcon />
                )}
              </div>
            ) : (
              <NavLink
                to={item.path || '#'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-2 py-2 ${isItemActive(item) || isActive ? 'bg-gray-100 dark:bg-gray-800' : ''}`
                }
              >
                {item.icon}
                {isExpanded && <span>{item.name}</span>}
              </NavLink>
            )}

            {item.subItems && openSubmenu === item.name && (
              <div className="ml-4 mt-1 space-y-1">
                {item.subItems.map((sub) => (
                  <NavLink
                    key={sub.labelKey}
                    to={sub.path}
                    className={({ isActive }) =>
                      `block px-2 py-2 text-sm rounded ${isSubItemActive(sub.path) || isActive ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`
                    }
                  >
                    {sub.name}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
