import IncidentsListPage from '@/modules/discipline/pages/IncidentsListPage';
import IncidentCreatePage from '@/modules/discipline/pages/IncidentCreatePage';
import IncidentDetailPage from '@/modules/discipline/pages/IncidentDetailPage';
import DetentionSessionsPage from '@/modules/discipline/pages/DetentionSessionsPage';
import MyDisciplinePage from '@/modules/discipline/pages/MyDisciplinePage';
import GuardianChildRecordPage from '@/modules/discipline/pages/GuardianChildRecordPage';
import { RoleGuard } from '@/guards';
import CategoriesPage from '@/modules/discipline/pages/CategoriesPage';

export const disciplineRoutes = [
  { path: '/discipline/incidents', element: (<RoleGuard roles={["ADMIN","STAFF","TEACHER"]}><IncidentsListPage /></RoleGuard>) },
  { path: '/discipline/incidents/new', element: (<RoleGuard roles={["ADMIN","STAFF","TEACHER"]}><IncidentCreatePage /></RoleGuard>) },
  { path: '/discipline/incidents/:id', element: (<RoleGuard roles={["ADMIN","STAFF","TEACHER"]}><IncidentDetailPage /></RoleGuard>) },
  { path: '/discipline/detention', element: (<RoleGuard roles={["ADMIN","STAFF"]}><DetentionSessionsPage /></RoleGuard>) },
  { path: '/discipline/categories', element: (<RoleGuard roles={["ADMIN","STAFF"]}><CategoriesPage /></RoleGuard>) },
  { path: '/discipline/me', element: (<RoleGuard roles={["STUDENT","ADMIN","STAFF","TEACHER","GUARDIAN"]}><MyDisciplinePage /></RoleGuard>) },
  { path: '/discipline/guardian/:studentId?', element: (<RoleGuard roles={["GUARDIAN","ADMIN","STAFF"]}><GuardianChildRecordPage /></RoleGuard>) },
];
