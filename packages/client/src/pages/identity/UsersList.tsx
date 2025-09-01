import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, patch, post } from '@/lib/api';
import { downloadCSV } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { 
  Plus, 
  Search, 
  Eye, 
  Download, 
  Filter,
  UserCheck,
  UserX,
  Lock,
  Unlock,
  Users,
  Calendar,
  Clock,
  Shield,
  Mail,
  Hash
} from 'lucide-react';

export type UserRow = {
  id: string;
  email: string | null;
  loginId: string | null;
  authMethod: 'EMAIL' | 'LOGIN_ID';
  isActive: boolean;
  failedLogins: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  secretUpdatedAt: string | null;
  createdAt: string;
  roles?: string[];
  profile?: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
    photoUrl?: string;
  };
};

type FilterType = 'all' | 'active' | 'inactive' | 'locked' | 'admin' | 'staff' | 'teacher' | 'student';

export function UsersList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
    variant?: 'default' | 'destructive';
  }>({ open: false, title: '', description: '', action: () => {} });

  const { data, isLoading, error } = useQuery<UserRow[]>({
    queryKey: ['admin-users'],
    queryFn: () => get<UserRow[]>('admin/users'),
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) => 
      patch(`admin/users/${userId}/status`, { isActive }),
    onSuccess: () => {
      toast.success('Statut utilisateur mis à jour');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const lockUserMutation = useMutation({
    mutationFn: (userId: string) => post(`admin/users/${userId}/lock`, {}),
    onSuccess: () => {
      toast.success('Utilisateur verrouillé');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const unlockUserMutation = useMutation({
    mutationFn: (userId: string) => post(`admin/users/${userId}/unlock`, {}),
    onSuccess: () => {
      toast.success('Utilisateur déverrouillé');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const rows = data ?? [];
  
  // Filter and search logic
  const filteredRows = rows.filter(user => {
    // Search filter
    const matchesSearch = !searchQuery || 
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.loginId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.profile?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.profile?.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.id.toLowerCase().includes(searchQuery.toLowerCase());

    // Status filter
    const matchesFilter = (() => {
      switch (selectedFilter) {
        case 'active': return user.isActive;
        case 'inactive': return !user.isActive;
        case 'locked': return user.lockedUntil && new Date(user.lockedUntil) > new Date();
        case 'admin': return user.roles?.includes('ADMIN');
        case 'staff': return user.roles?.includes('STAFF');
        case 'teacher': return user.roles?.includes('TEACHER');
        case 'student': return user.roles?.includes('STUDENT');
        default: return true;
      }
    })();

    return matchesSearch && matchesFilter;
  });

  const handleSelectAll = (checked: boolean) => {
    setSelectedUsers(checked ? filteredRows.map(u => u.id) : []);
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    setSelectedUsers(prev => 
      checked 
        ? [...prev, userId]
        : prev.filter(id => id !== userId)
    );
  };

  const handleToggleStatus = (user: UserRow) => {
    setConfirmDialog({
      open: true,
      title: user.isActive ? 'Désactiver l\'utilisateur' : 'Activer l\'utilisateur',
      description: `Êtes-vous sûr de vouloir ${user.isActive ? 'désactiver' : 'activer'} cet utilisateur ?`,
      action: () => {
        toggleUserStatusMutation.mutate({ userId: user.id, isActive: !user.isActive });
        setConfirmDialog({ ...confirmDialog, open: false });
      },
    });
  };

  const handleLockUser = (user: UserRow) => {
    const isLocked = user.lockedUntil && new Date(user.lockedUntil) > new Date();
    
    setConfirmDialog({
      open: true,
      title: isLocked ? 'Déverrouiller l\'utilisateur' : 'Verrouiller l\'utilisateur',
      description: `Êtes-vous sûr de vouloir ${isLocked ? 'déverrouiller' : 'verrouiller'} cet utilisateur ?`,
      action: () => {
        if (isLocked) {
          unlockUserMutation.mutate(user.id);
        } else {
          lockUserMutation.mutate(user.id);
        }
        setConfirmDialog({ ...confirmDialog, open: false });
      },
    });
  };

  const onExport = () => downloadCSV(filteredRows, 'users.csv');

  const getStatusBadge = (user: UserRow) => {
    const isLocked = user.lockedUntil && new Date(user.lockedUntil) > new Date();
    
    if (isLocked) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-warning-100 text-warning-800 dark:bg-warning-900/20 dark:text-warning-400">
          <Lock className="h-3 w-3" />
          Verrouillé
        </span>
      );
    }
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
        user.isActive 
          ? 'bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-400'
          : 'bg-error-100 text-error-800 dark:bg-error-900/20 dark:text-error-400'
      }`}>
        {user.isActive ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
        {user.isActive ? 'Actif' : 'Inactif'}
      </span>
    );
  };

  const getRoleBadges = (roles: string[] = []) => {
    const roleColors = {
      ADMIN: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
      STAFF: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      TEACHER: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      STUDENT: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      GUARDIAN: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
    };

    return (
      <div className="flex flex-wrap gap-1">
        {roles.map(role => (
          <span key={role} className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
            roleColors[role as keyof typeof roleColors] || roleColors.STUDENT
          }`}>
            {role}
          </span>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-error-100 dark:bg-error-900/40 rounded-lg">
              <Users className="h-5 w-5 text-error-600 dark:text-error-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-error-900 dark:text-error-100">Erreur de chargement</h3>
              <p className="text-error-700 dark:text-error-300 mt-1">Impossible de charger la liste des utilisateurs.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Utilisateurs</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gérer les utilisateurs du système ({filteredRows.length} utilisateur{filteredRows.length !== 1 ? 's' : ''})
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/identity/users/create')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-colors duration-200 shadow-theme-sm hover:shadow-theme-md"
          >
            <Plus className="h-4 w-4" />
            Nouvel utilisateur
          </button>
          <button 
            onClick={onExport} 
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors duration-200"
          >
            <Download className="h-4 w-4" />
            Exporter
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, email, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>
          
          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 border rounded-lg font-medium transition-colors duration-200 ${
              showFilters
                ? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-900/20 dark:border-brand-800 dark:text-brand-400'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filtres
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'Tous', icon: Users },
                { key: 'active', label: 'Actifs', icon: UserCheck },
                { key: 'inactive', label: 'Inactifs', icon: UserX },
                { key: 'locked', label: 'Verrouillés', icon: Lock },
                { key: 'admin', label: 'Admins', icon: Shield },
                { key: 'staff', label: 'Staff', icon: Users },
                { key: 'teacher', label: 'Enseignants', icon: Users },
                { key: 'student', label: 'Étudiants', icon: Users },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setSelectedFilter(key as FilterType)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
                    selectedFilter === key
                      ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/20 dark:text-brand-400'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-brand-800 dark:text-brand-300 font-medium">
              {selectedUsers.length} utilisateur{selectedUsers.length !== 1 ? 's' : ''} sélectionné{selectedUsers.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 text-sm bg-success-600 hover:bg-success-700 text-white rounded-lg transition-colors duration-200">
                Activer
              </button>
              <button className="px-3 py-1.5 text-sm bg-error-600 hover:bg-error-700 text-white rounded-lg transition-colors duration-200">
                Désactiver
              </button>
              <button 
                onClick={() => setSelectedUsers([])}
                className="px-3 py-1.5 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors duration-200"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {filteredRows.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchQuery || selectedFilter !== 'all' ? 'Aucun utilisateur trouvé' : 'Aucun utilisateur'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {searchQuery || selectedFilter !== 'all' 
                ? 'Essayez de modifier vos critères de recherche ou filtres.'
                : 'Commencez par créer votre premier utilisateur.'
              }
            </p>
            {(!searchQuery && selectedFilter === 'all') && (
              <button
                onClick={() => navigate('/identity/users/create')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-colors duration-200"
              >
                <Plus className="h-4 w-4" />
                Créer un utilisateur
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === filteredRows.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Utilisateur
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Authentification
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Rôles
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Dernière connexion
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredRows.map((user) => {
                  const isLocked = user.lockedUntil && new Date(user.lockedUntil) > new Date();
                  
                  return (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={(e) => handleSelectUser(user.id, e.target.checked)}
                          className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            {user.profile?.photoUrl ? (
                              <img
                                src={user.profile.photoUrl}
                                alt="Profile"
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                <Users className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {user.profile?.firstName && user.profile?.lastName 
                                ? `${user.profile.firstName} ${user.profile.lastName}`
                                : user.email || user.loginId || 'Utilisateur sans nom'
                              }
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                              {user.email && (
                                <>
                                  <Mail className="h-3 w-3" />
                                  {user.email}
                                </>
                              )}
                              {user.loginId && (
                                <>
                                  <Hash className="h-3 w-3" />
                                  {user.loginId}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                          user.authMethod === 'EMAIL' 
                            ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/20 dark:text-brand-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {user.authMethod === 'EMAIL' ? <Mail className="h-3 w-3" /> : <Hash className="h-3 w-3" />}
                          {user.authMethod === 'EMAIL' ? 'Email' : 'Login ID'}
                        </span>
                        {user.failedLogins > 0 && (
                          <div className="text-xs text-error-600 dark:text-error-400 mt-1">
                            {user.failedLogins} échec{user.failedLogins !== 1 ? 's' : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {getRoleBadges(user.roles)}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(user)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {user.lastLoginAt ? (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-gray-400" />
                              <span>{new Date(user.lastLoginAt).toLocaleDateString()}</span>
                            </div>
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400">Jamais</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          Créé le {new Date(user.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/identity/users/${user.id}`)}
                            className="p-1.5 text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                            title="Voir les détails"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(user)}
                            className={`p-1.5 rounded-lg transition-colors duration-200 ${
                              user.isActive
                                ? 'text-error-600 hover:text-error-700 hover:bg-error-50 dark:hover:bg-error-900/20'
                                : 'text-success-600 hover:text-success-700 hover:bg-success-50 dark:hover:bg-success-900/20'
                            }`}
                            title={user.isActive ? 'Désactiver' : 'Activer'}
                          >
                            {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => handleLockUser(user)}
                            className={`p-1.5 rounded-lg transition-colors duration-200 ${
                              isLocked
                                ? 'text-success-600 hover:text-success-700 hover:bg-success-50 dark:hover:bg-success-900/20'
                                : 'text-warning-600 hover:text-warning-700 hover:bg-warning-50 dark:hover:bg-warning-900/20'
                            }`}
                            title={isLocked ? 'Déverrouiller' : 'Verrouiller'}
                          >
                            {isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {filteredRows.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Affichage de {filteredRows.length} utilisateur{filteredRows.length !== 1 ? 's' : ''}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {/* Pagination controls would go here */}
              Page 1 sur 1
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.action}
        variant={confirmDialog.variant}
      />
    </div>
  );
}