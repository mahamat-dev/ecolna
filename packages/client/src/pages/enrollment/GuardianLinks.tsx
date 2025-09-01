import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, del } from '@/lib/api';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { DataGrid } from '@/components/DataGrid';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormField, Select, Input } from '@/components/FormField';
import { Plus, Trash2, X, Users, UserCheck, Search } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

interface Profile extends Record<string, unknown> {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  userId: string;
  rollNo?: string;
}

interface GuardianLink extends Record<string, unknown> {
  guardianProfileId: string;
  studentProfileId: string;
  linkType?: string;
  isPrimary: boolean;
  guardian?: Profile;
  student?: Profile;
}

interface LinkFormData {
  guardianProfileId: string;
  studentProfileId: string;
  linkType?: string;
  isPrimary: boolean;
}

export function GuardianLinks() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    link: GuardianLink | null;
  }>({ open: false, link: null });

  const { data: links = [], isLoading: linksLoading, error: linksError } = useQuery({
    queryKey: ['guardian-links'],
    queryFn: () => get<GuardianLink[]>('enrollment/links/guardian-student'),
  });

  const { data: guardians = [], isLoading: guardiansLoading, error: guardiansError } = useQuery({
    queryKey: ['guardians'],
    queryFn: () => get<Profile[]>('enrollment/guardians'),
  });

  const { data: students = [], isLoading: studentsLoading, error: studentsError } = useQuery({
    queryKey: ['students'],
    queryFn: () => get<Profile[]>('enrollment/students'),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<LinkFormData>({
    defaultValues: {
      isPrimary: false,
      linkType: 'PARENT'
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: LinkFormData) => post('enrollment/links/guardian-student', data),
    onSuccess: () => {
      toast.success('Lien créé avec succès');
      queryClient.invalidateQueries({ queryKey: ['guardian-links'] });
      setIsCreateOpen(false);
      reset();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (link: GuardianLink) => 
      del(`enrollment/links/guardian-student/${link.guardianProfileId}/${link.studentProfileId}`),
    onSuccess: () => {
      toast.success('Lien supprimé');
      queryClient.invalidateQueries({ queryKey: ['guardian-links'] });
      setDeleteDialog({ open: false, link: null });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const columns: ColumnDef<GuardianLink, unknown>[] = [
    {
      id: 'guardian',
      header: 'Parent/Tuteur',
      cell: ({ row }) => {
        const guardian = guardians.find(g => g.id === row.original.guardianProfileId);
        return guardian ? (
          <div>
            <div className="font-medium">{guardian.firstName} {guardian.lastName}</div>
            {guardian.phone && (
              <div className="text-xs text-gray-500">{guardian.phone}</div>
            )}
          </div>
        ) : '-';
      },
    },
    {
      id: 'student',
      header: 'Étudiant',
      cell: ({ row }) => {
        const student = students.find(s => s.id === row.original.studentProfileId);
        return student ? (
          <div className="font-medium">{student.firstName} {student.lastName}</div>
        ) : '-';
      },
    },
    {
      accessorKey: 'linkType',
      header: 'Type de lien',
      cell: ({ row }) => {
        const type = row.original.linkType;
        const typeLabels = {
          PARENT: 'Parent',
          GUARDIAN: 'Tuteur',
          RELATIVE: 'Proche',
          OTHER: 'Autre'
        };
        return typeLabels[type as keyof typeof typeLabels] || type || '-';
      },
    },
    {
      accessorKey: 'isPrimary',
      header: 'Contact principal',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {row.original.isPrimary ? (
            <>
              <UserCheck className="h-4 w-4 text-green-600" />
              <span className="text-green-600 text-sm">Oui</span>
            </>
          ) : (
            <span className="text-gray-500 text-sm">Non</span>
          )}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button
            onClick={() => setDeleteDialog({ open: true, link: row.original })}
            className="p-1 text-red-600 hover:bg-red-50 rounded"
            title="Supprimer le lien"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const onSubmit = (data: LinkFormData) => {
    createMutation.mutate(data);
  };

  const handleCancel = () => {
    setIsCreateOpen(false);
    setStudentSearch('');
    reset();
  };

  const isSubmitting = createMutation.isPending;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Liens Parents-Étudiants</h1>
          <p className="text-gray-600 mt-1">Gérer les relations entre parents/tuteurs et étudiants</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nouveau lien
        </button>
      </div>

      {isCreateOpen && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Créer un lien parent-étudiant
            </h2>
            <button
              onClick={handleCancel}
              className="p-1 text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Parent/Tuteur" required error={errors.guardianProfileId?.message}>
                <Select
                  {...register('guardianProfileId', { required: 'Le parent/tuteur est requis' })}
                  error={!!errors.guardianProfileId}
                >
                  <option value="">Sélectionner un parent/tuteur</option>
                  {guardians.map(guardian => (
                    <option key={guardian.id} value={guardian.id}>
                      {guardian.firstName} {guardian.lastName}
                      {guardian.phone && ` (${guardian.phone})`}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Étudiant" required error={errors.studentProfileId?.message}>
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Rechercher par nom ou matricule (ex: S14232)..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select
                    {...register('studentProfileId', { required: 'L\'étudiant est requis' })}
                    error={!!errors.studentProfileId}
                    size={8}
                  >
                    <option value="">Sélectionner un étudiant</option>
                    {students
                      .filter(student => {
                        if (!studentSearch) return true;
                        const searchLower = studentSearch.toLowerCase();
                        const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
                        const rollNo = student.rollNo?.toLowerCase() || '';
                        return fullName.includes(searchLower) || rollNo.includes(searchLower);
                      })
                      .map(student => (
                        <option key={student.id} value={student.id}>
                          {student.firstName} {student.lastName}
                          {student.rollNo && ` (${student.rollNo})`}
                        </option>
                      ))}
                  </Select>
                </div>
              </FormField>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Type de lien">
                <Select {...register('linkType')}>
                  <option value="PARENT">Parent</option>
                  <option value="GUARDIAN">Tuteur</option>
                  <option value="RELATIVE">Proche</option>
                  <option value="OTHER">Autre</option>
                </Select>
              </FormField>
              <FormField label="Contact principal">
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    {...register('isPrimary')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="text-sm text-gray-700">
                    Ce parent/tuteur est le contact principal
                  </label>
                </div>
              </FormField>
            </div>
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Création...' : 'Créer le lien'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Debug Information */}
      {(linksError || guardiansError || studentsError) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h3 className="text-red-800 font-medium mb-2">Erreurs de chargement:</h3>
          {linksError && <p className="text-red-700 text-sm">Liens: {linksError.message}</p>}
          {guardiansError && <p className="text-red-700 text-sm">Parents: {guardiansError.message}</p>}
          {studentsError && <p className="text-red-700 text-sm">Étudiants: {studentsError.message}</p>}
        </div>
      )}

      {/* Data Summary */}
      <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-xl p-6 mb-6">
        <h3 className="text-brand-800 dark:text-brand-300 font-semibold mb-4">État des données</h3>
        <div className="grid grid-cols-3 gap-6 text-sm">
          <div>
            <span className="text-brand-700 dark:text-brand-400 font-medium">Étudiants: </span>
            <span className="font-semibold text-gray-900 dark:text-white">{studentsLoading ? 'Chargement...' : students.length}</span>
          </div>
          <div>
            <span className="text-brand-700 dark:text-brand-400 font-medium">Parents: </span>
            <span className="font-semibold text-gray-900 dark:text-white">{guardiansLoading ? 'Chargement...' : guardians.length}</span>
          </div>
          <div>
            <span className="text-brand-700 dark:text-brand-400 font-medium">Liens: </span>
            <span className="font-semibold text-gray-900 dark:text-white">{linksLoading ? 'Chargement...' : links.length}</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {linksLoading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            </div>
          </div>
        ) : (
          <DataGrid
              columns={columns}
              data={links}
              csvName="liens-parents-etudiants.csv"
            />
        )}
      </div>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, link: deleteDialog.link })}
        title="Supprimer le lien"
        description={`Êtes-vous sûr de vouloir supprimer ce lien parent-étudiant ? Cette action est irréversible.`}
        confirmText="Supprimer"
        variant="destructive"
        onConfirm={() => deleteDialog.link && deleteMutation.mutate(deleteDialog.link)}
      />
    </div>
  );
}