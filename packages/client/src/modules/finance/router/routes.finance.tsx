import FeeSchedulesPage from '@/modules/finance/pages/FeeSchedulesPage';
import AssignFeePage from '@/modules/finance/pages/AssignFeePage';
import InvoicesListPage from '@/modules/finance/pages/InvoicesListPage';
import InvoiceCreatePage from '@/modules/finance/pages/InvoiceCreatePage';
import InvoiceDetailPage from '@/modules/finance/pages/InvoiceDetailPage';
import PaymentsPage from '@/modules/finance/pages/PaymentsPage';
import AdvancesRequestPage from '@/modules/finance/pages/AdvancesRequestPage';
import AdvancesAdminPage from '@/modules/finance/pages/AdvancesAdminPage';
import PayrollPeriodsPage from '@/modules/finance/pages/PayrollPeriodsPage';
import PayrollPeriodDetailPage from '@/modules/finance/pages/PayrollPeriodDetailPage';
import MyInvoicesPage from '@/modules/finance/pages/MyInvoicesPage';
import MyPayslipsPage from '@/modules/finance/pages/MyPayslipsPage';
import { RoleGuard } from '@/guards';

export const financeRoutes = [
  { path: '/finance/fees/schedules', element: (<RoleGuard roles={["ADMIN","STAFF"]}><FeeSchedulesPage /></RoleGuard>) },
  { path: '/finance/fees/assign', element: (<RoleGuard roles={["ADMIN","STAFF"]}><AssignFeePage /></RoleGuard>) },
  { path: '/finance/invoices', element: (<RoleGuard roles={["ADMIN","STAFF"]}><InvoicesListPage /></RoleGuard>) },
  { path: '/finance/invoices/new', element: (<RoleGuard roles={["ADMIN","STAFF"]}><InvoiceCreatePage /></RoleGuard>) },
  { path: '/finance/invoices/:id', element: (<RoleGuard roles={["ADMIN","STAFF","STUDENT","GUARDIAN"]}><InvoiceDetailPage /></RoleGuard>) },
  { path: '/finance/payments', element: (<RoleGuard roles={["ADMIN","STAFF"]}><PaymentsPage /></RoleGuard>) },
  { path: '/finance/advances', element: (<RoleGuard roles={["ADMIN","STAFF","TEACHER","STUDENT","GUARDIAN"]}><AdvancesRequestPage /></RoleGuard>) },
  { path: '/finance/advances/admin', element: (<RoleGuard roles={["ADMIN","STAFF"]}><AdvancesAdminPage /></RoleGuard>) },
  { path: '/finance/payroll', element: (<RoleGuard roles={["ADMIN","STAFF"]}><PayrollPeriodsPage /></RoleGuard>) },
  { path: '/finance/payroll/:periodId', element: (<RoleGuard roles={["ADMIN","STAFF"]}><PayrollPeriodDetailPage /></RoleGuard>) },
  { path: '/finance/me/invoices', element: (<RoleGuard roles={["STUDENT","GUARDIAN","ADMIN","STAFF","TEACHER"]}><MyInvoicesPage /></RoleGuard>) },
  { path: '/finance/me/payslips', element: (<RoleGuard roles={["STAFF","TEACHER","ADMIN"]}><MyPayslipsPage /></RoleGuard>) },
];

