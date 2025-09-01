import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, patch } from '@/lib/api';
import { toast } from 'sonner';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CopyableSecret } from '@/components/CopyableSecret';
import { FormField, Input } from '@/components/FormField';
import { ArrowLeft, Lock, Unlock, RotateCcw, Key, Edit, Save, X } from 'lucide-react';

interface User {
  id: string;
  email?: string;
  loginId?: string;
  authMethod: 'EMAIL' | 'LOGIN_ID';
  isActive: boolean;
  lockedUntil?: string;
  roles: string[];
  profile?: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
    dob?: string;
    photoUrl?: string;
    address?: string;
    city?: string;
    region?: string;
    country?: string;
  };
}

interface ProfileFormData {
  firstName: string;
  lastName: string;
  phone?: string;
  dob?: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
}

export function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
    variant?: 'default' | 'destructive';
  }>({ open: false, title: '', description: '', action: () => {} });
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [newLoginId, setNewLoginId] = useState<string | null>(null);

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: () => get<User>(`admin/users/${id}`),
    enabled: !!id,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileFormData>({
    values: user?.profile ? {
      firstName: user.profile.firstName,
      lastName: user.profile.lastName,
      phone: user.profile.phone || '',
      dob: user.profile.dob || '',
      address: user.profile.address || '',
      city: user.profile.city || '',
      region: user.profile.region || '',
      country: user.profile.country || '',
    } : undefined
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileFormData) => patch(`admin/profiles/${user?.profile?.id}`, data),
    onSuccess: () => {
      toast.success('Profil mis à jour');
      queryClient.invalidateQueries({ queryKey: ['user', id] });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: () => patch(`admin/users/${id}/status`, { isActive: !user?.isActive }),
    onSuccess: () => {
      toast.success(user?.isActive ? 'Utilisateur désactivé' : 'Utilisateur activé');
      queryClient.invalidateQueries({ queryKey: ['user', id] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const lockUserMutation = useMutation({
    mutationFn: () => post(`admin/users/${id}/lock`),
    onSuccess: () => {
      toast.success('Utilisateur verrouillé');
      queryClient.invalidateQueries({ queryKey: ['user', id] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const unlockUserMutation = useMutation({
    mutationFn: () => post(`admin/users/${id}/unlock`),
    onSuccess: () => {
      toast.success('Utilisateur déverrouillé');
      queryClient.invalidateQueries({ queryKey: ['user', id] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetSecretMutation = useMutation({
    mutationFn: () => post<{ newSecret: string }>(`admin/users/${id}/reset-secret`),
    onSuccess: (data) => {
      setNewSecret(data.newSecret);
      toast.success('Secret réinitialisé');
      queryClient.invalidateQueries({ queryKey: ['user', id] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const rotateLoginIdMutation = useMutation({
    mutationFn: () => post<{ newLoginId: string }>(`admin/users/${id}/rotate-login-id`),
    onSuccess: (data) => {
      setNewLoginId(data.newLoginId);
      toast.success('Login ID mis à jour');
      queryClient.invalidateQueries({ queryKey: ['user', id] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const onSubmitProfile = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  const handleCancelEdit = () => {
    reset();
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">Utilisateur introuvable</h1>
          <button
            onClick={() => navigate('/identity/users')}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retour à la liste
          </button>
        </div>
      </div>
    );
  }

  const isLocked = user.lockedUntil && new Date(user.lockedUntil) > new Date();
  const canResetSecret = user.authMethod === 'LOGIN_ID';
  const canRotateLoginId = user.authMethod === 'LOGIN_ID';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/identity/users')}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {user.profile?.firstName} {user.profile?.lastName}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Détails de l'utilisateur</p>
        </div>
        <div className="flex gap-2">
          {user.isActive ? (
            <span className="inline-flex px-3 py-1 bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-400 text-sm font-medium rounded-full">Actif</span>
          ) : (
            <span className="inline-flex px-3 py-1 bg-error-100 text-error-800 dark:bg-error-900/20 dark:text-error-400 text-sm font-medium rounded-full">Inactif</span>
          )}
          {isLocked && (
            <span className="inline-flex px-3 py-1 bg-warning-100 text-warning-800 dark:bg-warning-900/20 dark:text-warning-400 text-sm font-medium rounded-full">Verrouillé</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Informations de base</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">ID:</span>
                <p className="font-mono text-sm text-gray-900 dark:text-white mt-1">{user.id}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Méthode d'auth:</span>
                <p className="text-sm text-gray-900 dark:text-white mt-1">{user.authMethod === 'EMAIL' ? 'Email' : 'Login ID'}</p>
              </div>
              {user.email && (
                <div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Email:</span>
                  <p className="text-sm text-gray-900 dark:text-white mt-1">{user.email}</p>
                </div>
              )}
              {user.loginId && (
                <div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Login ID:</span>
                  <p className="font-mono text-sm text-gray-900 dark:text-white mt-1">{user.loginId}</p>
                </div>
              )}
              <div className="md:col-span-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Rôles:</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {user.roles.map((role) => (
                    <span key={role} className="inline-flex px-2 py-1 bg-brand-100 text-brand-800 dark:bg-brand-900/20 dark:text-brand-400 text-xs font-medium rounded-full">
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Profile */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Profil</h2>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors duration-200"
                >
                  <Edit className="h-4 w-4" />
                  Modifier
                </button>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={handleSubmit(onSubmitProfile)}
                    disabled={updateProfileMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="h-4 w-4" />
                    Enregistrer
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
                  >
                    <X className="h-4 w-4" />
                    Annuler
                  </button>
                </div>
              )}
            </div>

            {isEditing ? (
              <form className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Prénom" required error={errors.firstName?.message}>
                    <Input {...register('firstName', { required: 'Prénom requis' })} error={!!errors.firstName} />
                  </FormField>
                  <FormField label="Nom" required error={errors.lastName?.message}>
                    <Input {...register('lastName', { required: 'Nom requis' })} error={!!errors.lastName} />
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Téléphone">
                    <Input {...register('phone')} type="tel" />
                  </FormField>
                  <FormField label="Date de naissance">
                    <Input {...register('dob')} type="date" />
                  </FormField>
                </div>
                <FormField label="Adresse">
                  <Input {...register('address')} />
                </FormField>
                <div className="grid grid-cols-3 gap-4">
                  <FormField label="Ville">
                    <Input {...register('city')} />
                  </FormField>
                  <FormField label="Région">
                    <Input {...register('region')} />
                  </FormField>
                  <FormField label="Pays">
                    <Input {...register('country')} />
                  </FormField>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Prénom:</span>
                  <p className="text-sm text-gray-900 dark:text-white mt-1">{user.profile?.firstName || '-'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Nom:</span>
                  <p className="text-sm text-gray-900 dark:text-white mt-1">{user.profile?.lastName || '-'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Téléphone:</span>
                  <p className="text-sm text-gray-900 dark:text-white mt-1">{user.profile?.phone || '-'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Date de naissance:</span>
                  <p className="text-sm text-gray-900 dark:text-white mt-1">{user.profile?.dob || '-'}</p>
                </div>
                <div className="md:col-span-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Adresse:</span>
                  <p className="text-sm text-gray-900 dark:text-white mt-1">{user.profile?.address || '-'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Ville:</span>
                  <p className="text-sm text-gray-900 dark:text-white mt-1">{user.profile?.city || '-'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Région:</span>
                  <p className="text-sm text-gray-900 dark:text-white mt-1">{user.profile?.region || '-'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Pays:</span>
                  <p className="text-sm text-gray-900 dark:text-white mt-1">{user.profile?.country || '-'}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-6">
          {/* Status Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Actions</h3>
            <div className="space-y-4">
              <button
                onClick={() => setConfirmDialog({
                  open: true,
                  title: user.isActive ? 'Désactiver l\'utilisateur' : 'Activer l\'utilisateur',
                  description: user.isActive 
                    ? 'L\'utilisateur ne pourra plus se connecter.'
                    : 'L\'utilisateur pourra se connecter.',
                  action: () => toggleStatusMutation.mutate(),
                  variant: user.isActive ? 'destructive' : 'default'
                })}
                disabled={toggleStatusMutation.isPending}
                className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                  user.isActive
                    ? 'bg-error-100 text-error-700 hover:bg-error-200 dark:bg-error-900/20 dark:text-error-400 dark:hover:bg-error-900/30'
                    : 'bg-success-100 text-success-700 hover:bg-success-200 dark:bg-success-900/20 dark:text-success-400 dark:hover:bg-success-900/30'
                }`}
              >
                {user.isActive ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
                {user.isActive ? 'Désactiver' : 'Activer'}
              </button>

              {isLocked ? (
                <button
                  onClick={() => setConfirmDialog({
                    open: true,
                    title: 'Déverrouiller l\'utilisateur',
                    description: 'L\'utilisateur pourra se connecter à nouveau.',
                    action: () => unlockUserMutation.mutate()
                  })}
                  disabled={unlockUserMutation.isPending}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-warning-100 text-warning-700 hover:bg-warning-200 dark:bg-warning-900/20 dark:text-warning-400 dark:hover:bg-warning-900/30 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Unlock className="h-5 w-5" />
                  Déverrouiller
                </button>
              ) : (
                <button
                  onClick={() => setConfirmDialog({
                    open: true,
                    title: 'Verrouiller l\'utilisateur',
                    description: 'L\'utilisateur sera temporairement bloqué.',
                    action: () => lockUserMutation.mutate(),
                    variant: 'destructive'
                  })}
                  disabled={lockUserMutation.isPending}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-warning-100 text-warning-700 hover:bg-warning-200 dark:bg-warning-900/20 dark:text-warning-400 dark:hover:bg-warning-900/30 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Lock className="h-5 w-5" />
                  Verrouiller
                </button>
              )}

              {canResetSecret && (
                <button
                  onClick={() => setConfirmDialog({
                    open: true,
                    title: 'Réinitialiser le secret',
                    description: 'Un nouveau secret temporaire sera généré.',
                    action: () => resetSecretMutation.mutate(),
                    variant: 'destructive'
                  })}
                  disabled={resetSecretMutation.isPending}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-brand-100 text-brand-700 hover:bg-brand-200 dark:bg-brand-900/20 dark:text-brand-400 dark:hover:bg-brand-900/30 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Key className="h-5 w-5" />
                  Réinitialiser le secret
                </button>
              )}

              {canRotateLoginId && (
                <button
                  onClick={() => setConfirmDialog({
                    open: true,
                    title: 'Changer le Login ID',
                    description: 'Un nouveau Login ID sera généré.',
                    action: () => rotateLoginIdMutation.mutate(),
                    variant: 'destructive'
                  })}
                  disabled={rotateLoginIdMutation.isPending}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-brand-100 text-brand-700 hover:bg-brand-200 dark:bg-brand-900/20 dark:text-brand-400 dark:hover:bg-brand-900/30 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="h-5 w-5" />
                  Changer Login ID
                </button>
              )}
            </div>
          </div>

          {/* New Credentials */}
          {(newSecret || newLoginId) && (
            <div className="space-y-4">
              {newSecret && (
                <CopyableSecret
                  value={newSecret}
                  label="Nouveau secret"
                  description="⚠️ Notez ce secret - il ne sera plus affiché"
                  variant="warning"
                />
              )}
              {newLoginId && (
                <CopyableSecret
                  value={newLoginId}
                  label="Nouveau Login ID"
                  description="L'ancien Login ID n'est plus valide"
                  variant="warning"
                />
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.action}
        variant={confirmDialog.variant}
      />
    </div>
  );
}