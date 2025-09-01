import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { Users, GraduationCap, BookOpen, Calendar, TrendingUp, UserPlus, FileText, Clock } from 'lucide-react';
import { useNotesList } from '@/modules/content/hooks';

interface DashboardMetrics {
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  totalSections: number;
  activeEnrollments: number;
  pendingAttendance: number;
}

interface RecentActivity {
  id: string;
  type: 'enrollment' | 'user_created' | 'attendance' | 'teaching';
  description: string;
  timestamp: string;
  user?: string;
}

interface QuickAction {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  color: string;
}

export default function Dashboard() {
  const navigate = useNavigate();

  // Fetch dashboard metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      // Simulate API calls to get dashboard data
      const [users, sections] = await Promise.all([
         get<Array<{ roles?: string[] }>>('admin/users').catch(() => []),
         get<Array<{ id: string; name: string }>>('academics/class-sections').catch(() => [])
       ]);
      
      const totalUsers = users.length;
      const totalStudents = users.filter(u => u.roles?.includes('STUDENT')).length;
      const totalTeachers = users.filter(u => u.roles?.includes('TEACHER')).length;
      const totalSections = sections.length;
      
      return {
        totalUsers,
        totalStudents,
        totalTeachers,
        totalSections,
        activeEnrollments: Math.floor(totalStudents * 0.85), // Simulated
        pendingAttendance: Math.floor(totalSections * 0.3) // Simulated
      } as DashboardMetrics;
    },
  });

  // Recent content (notes)
  const { data: notesData, isLoading: notesLoading } = useNotesList({ limit: 5 });

  // Simulate recent activity data
  const { data: recentActivity } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      // This would typically come from an audit log API
      return [
        {
          id: '1',
          type: 'user_created' as const,
          description: 'Nouvel étudiant créé: Marie Dubois',
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          user: 'Admin'
        },
        {
          id: '2',
          type: 'enrollment' as const,
          description: 'Inscription en 2nde A: Jean Martin',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          user: 'Admin'
        },
        {
          id: '3',
          type: 'attendance' as const,
          description: 'Présence prise pour 1ère B - Mathématiques',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
          user: 'Prof. Durand'
        }
      ] as RecentActivity[];
    },
  });

  const quickActions: QuickAction[] = [
    {
      title: 'Créer un utilisateur',
      description: 'Ajouter un nouvel étudiant, enseignant ou admin',
      icon: UserPlus,
      path: '/identity/users/create',
      color: 'bg-brand-500'
    },
    {
      title: 'Nouvelle inscription',
      description: 'Inscrire un étudiant dans une classe',
      icon: GraduationCap,
      path: '/enrollment',
      color: 'bg-success-500'
    },
    {
      title: 'Prendre présence',
      description: 'Marquer la présence des étudiants',
      icon: Clock,
      path: '/attendance/take',
      color: 'bg-warning-500'
    },
    {
      title: 'Rapport',
      description: 'Générer un rapport d\'activité',
      icon: FileText,
      path: '/reports',
      color: 'bg-brand-600'
    }
  ];

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `il y a ${diffInMinutes} min`;
    } else if (diffInMinutes < 1440) {
      return `il y a ${Math.floor(diffInMinutes / 60)} h`;
    } else {
      return `il y a ${Math.floor(diffInMinutes / 1440)} j`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Tableau de bord</h1>
        <p className="text-gray-600 dark:text-gray-400">Vue d'ensemble de votre établissement</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-theme-md transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Total Utilisateurs</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {metricsLoading ? '...' : metrics?.totalUsers || 0}
              </p>
            </div>
            <div className="h-14 w-14 bg-brand-50 dark:bg-brand-900/20 rounded-xl flex items-center justify-center">
              <Users className="h-7 w-7 text-brand-600 dark:text-brand-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <div className="flex items-center px-2 py-1 bg-success-50 dark:bg-success-900/20 rounded-full">
              <TrendingUp className="h-3 w-3 text-success-600 dark:text-success-400 mr-1" />
              <span className="text-xs font-medium text-success-600 dark:text-success-400">+12% ce mois</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-theme-md transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Étudiants</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {metricsLoading ? '...' : metrics?.totalStudents || 0}
              </p>
            </div>
            <div className="h-14 w-14 bg-success-50 dark:bg-success-900/20 rounded-xl flex items-center justify-center">
              <GraduationCap className="h-7 w-7 text-success-600 dark:text-success-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <div className="flex items-center px-2 py-1 bg-success-50 dark:bg-success-900/20 rounded-full">
              <TrendingUp className="h-3 w-3 text-success-600 dark:text-success-400 mr-1" />
              <span className="text-xs font-medium text-success-600 dark:text-success-400">+8% ce mois</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-theme-md transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Classes</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {metricsLoading ? '...' : metrics?.totalSections || 0}
              </p>
            </div>
            <div className="h-14 w-14 bg-warning-50 dark:bg-warning-900/20 rounded-xl flex items-center justify-center">
              <BookOpen className="h-7 w-7 text-warning-600 dark:text-warning-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Actives cette année</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-theme-md transition-shadow duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Inscriptions</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {metricsLoading ? '...' : metrics?.activeEnrollments || 0}
              </p>
            </div>
            <div className="h-14 w-14 bg-brand-50 dark:bg-brand-900/20 rounded-xl flex items-center justify-center">
              <Calendar className="h-7 w-7 text-brand-600 dark:text-brand-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">Actives</span>
          </div>
        </div>
      </div>

      {/* Notes récentes */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Notes récentes</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Derniers contenus publiés ou brouillons</p>
        </div>
        <div className="p-6">
          {notesLoading ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">Chargement…</p>
          ) : (
            <div className="space-y-3">
              {(notesData?.items || []).length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">Aucune note pour le moment</p>
              ) : (
                (notesData?.items || []).map(n => (
                  <div key={n.id} className="flex items-start justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors duration-200">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                          {n.locale.toUpperCase()}
                        </span>
                        <span className={`text-xs ${n.isPublished ? 'text-success-600' : 'text-warning-600'}`}>{n.isPublished ? 'Publié' : 'Brouillon'}</span>
                        {n.publishedAt && (
                          <span className="text-xs text-gray-500">• {new Date(n.publishedAt).toLocaleString()}</span>
                        )}
                      </div>
                      <div className="font-medium text-gray-900 dark:text-white truncate mt-1">{n.title}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="text-sm text-brand-600 dark:text-brand-400 hover:underline" onClick={() => navigate(`/content/notes/${n.id}`)}>Ouvrir</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          <div className="mt-6 flex items-center justify-end gap-3">
            <button 
              onClick={() => navigate('/content/notes')}
              className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              Voir toutes les notes →
            </button>
            <button 
              onClick={() => navigate('/content/notes/new')}
              className="inline-flex items-center gap-2 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-colors duration-200"
            >
              <FileText className="h-4 w-4" />
              Nouvelle note
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Actions rapides</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Accès direct aux fonctionnalités principales</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quickActions.map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={index}
                      onClick={() => navigate(action.path)}
                      className="group flex items-start p-5 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-brand-300 dark:hover:border-brand-600 hover:shadow-theme-sm transition-all duration-200 text-left bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750"
                    >
                      <div className={`h-12 w-12 ${action.color} rounded-xl flex items-center justify-center mr-4 flex-shrink-0 group-hover:scale-105 transition-transform duration-200`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors duration-200">{action.title}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{action.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Activité récente</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Dernières actions dans le système</p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {recentActivity?.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors duration-200">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 bg-brand-50 dark:bg-brand-900/20 rounded-full flex items-center justify-center">
                        {activity.type === 'user_created' && <UserPlus className="h-5 w-5 text-brand-600 dark:text-brand-400" />}
                        {activity.type === 'enrollment' && <GraduationCap className="h-5 w-5 text-brand-600 dark:text-brand-400" />}
                        {activity.type === 'attendance' && <Clock className="h-5 w-5 text-brand-600 dark:text-brand-400" />}
                        {activity.type === 'teaching' && <BookOpen className="h-5 w-5 text-brand-600 dark:text-brand-400" />}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{activity.description}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {activity.user} • {formatTimeAgo(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <button 
                  onClick={() => navigate('/audit')}
                  className="w-full text-center text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium py-2 px-4 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors duration-200"
                >
                  Voir toute l'activité →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Statistiques</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Évolution des inscriptions et de la présence</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Simple Bar Chart Simulation */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-6">Inscriptions par mois</h3>
              <div className="space-y-4">
                {['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun'].map((month) => {
                   const value = Math.floor(Math.random() * 100) + 20;
                   return (
                     <div key={month} className="flex items-center">
                      <div className="w-10 text-sm font-medium text-gray-600 dark:text-gray-400">{month}</div>
                      <div className="flex-1 mx-4">
                        <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                          <div 
                            className="bg-gradient-to-r from-brand-500 to-brand-600 h-3 rounded-full transition-all duration-500" 
                            style={{ width: `${value}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="w-10 text-sm font-medium text-gray-900 dark:text-white text-right">{value}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Attendance Chart */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-6">Taux de présence</h3>
              <div className="space-y-4">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'].map((day) => {
                   const value = Math.floor(Math.random() * 30) + 70;
                   return (
                     <div key={day} className="flex items-center">
                      <div className="w-10 text-sm font-medium text-gray-600 dark:text-gray-400">{day}</div>
                      <div className="flex-1 mx-4">
                        <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                          <div 
                            className="bg-gradient-to-r from-success-500 to-success-600 h-3 rounded-full transition-all duration-500" 
                            style={{ width: `${value}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="w-12 text-sm font-medium text-gray-900 dark:text-white text-right">{value}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}