import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, patch, del } from '@/lib/api';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { DataGrid } from '@/components/DataGrid';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormField, Input, Select, Textarea } from '@/components/FormField';
import { Plus, Edit, Trash2, X } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

interface EducationStage extends Record<string, unknown> {
  id: string;
  name: string;
}

interface Subject extends Record<string, unknown> {
  id: string;
  name: string;
  code: string;
  description?: string;
  stageId: string;
  createdAt: string;
  updatedAt: string;
  stage?: EducationStage;
}

interface SubjectFormData {
  name: string;
  code: string;
  description?: string;
  stageId: string;
}

export function Subjects() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    subject: Subject | null;
  }>({ open: false, subject: null });

  const { data: stages = [] } = useQuery({
    queryKey: ['education-stages'],
    queryFn: () => get<EducationStage[]>('academics/education-stages'),
  });

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => get<Subject[]>('academics/subjects'),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SubjectFormData>();

  const createMutation = useMutation({
    mutationFn: (data: SubjectFormData) => post('academics/subjects', data),
    onSuccess: () => {
      toast.success('Matière créée avec succès');
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setIsCreateOpen(false);
      reset();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SubjectFormData }) => 
      patch(`academics/subjects/${id}`, data),
    onSuccess: () => {
      toast.success('Matière mise à jour');
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setEditingSubject(null);
      reset();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del(`academics/subjects/${id}`),
    onSuccess: () => {
      toast.success('Matière supprimée');
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setDeleteDialog({ open: false, subject: null });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const columns: ColumnDef<Subject, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Nom',
    },
    {
      accessorKey: 'code',
      header: 'Code',
      cell: ({ row }) => (
        <code className="px-2 py-1 bg-gray-100 rounded text-sm">
          {row.original.code}
        </code>
      ),
    },
    {
      id: 'stage',
      header: 'Étape',
      cell: ({ row }) => {
        const stage = stages.find(s => s.id === row.original.stageId);
        return stage?.name || '-';
      },
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => row.original.description || '-',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingSubject(row.original);
              reset({
                name: row.original.name,
                code: row.original.code,
                description: row.original.description || '',
                stageId: row.original.stageId,
              });
            }}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
            title="Modifier"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDeleteDialog({ open: true, subject: row.original })}
            className="p-1 text-red-600 hover:bg-red-50 rounded"
            title="Supprimer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const onSubmit = (data: SubjectFormData) => {
    if (editingSubject) {
      updateMutation.mutate({ id: editingSubject.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCancel = () => {
    setIsCreateOpen(false);
    setEditingSubject(null);
    reset();
  };

  const isFormOpen = isCreateOpen || editingSubject !== null;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Matières</h1>
          <p className="text-gray-600 mt-1">Gérer les matières par étape d'éducation</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nouvelle matière
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {editingSubject ? 'Modifier la matière' : 'Nouvelle matière'}
            </h2>
            <button
              onClick={handleCancel}
              className="p-1 text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Nom" required error={errors.name?.message}>
                <Input
                  {...register('name', { required: 'Le nom est requis' })}
                  error={!!errors.name}
                  placeholder="Ex: Mathématiques, Français..."
                />
              </FormField>
              <FormField label="Code" required error={errors.code?.message}>
                <Input
                  {...register('code', { 
                    required: 'Le code est requis',
                    pattern: {
                      value: /^[A-Z0-9_]+$/,
                      message: 'Le code doit contenir uniquement des lettres majuscules, chiffres et underscores'
                    }
                  })}
                  error={!!errors.code}
                  placeholder="Ex: MATH, FR, ENG..."
                  style={{ textTransform: 'uppercase' }}
                />
              </FormField>
              <FormField label="Étape" required error={errors.stageId?.message}>
                <Select
                  {...register('stageId', { required: 'L\'étape est requise' })}
                  error={!!errors.stageId}
                >
                  <option value="">Sélectionner une étape</option>
                  {stages.map(stage => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            <FormField label="Description">
              <Textarea
                {...register('description')}
                placeholder="Description de la matière..."
                rows={3}
              />
            </FormField>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
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

      <div className="bg-white rounded-lg shadow">
        {isLoading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <DataGrid
              columns={columns}
              data={subjects}
              csvName="matieres.csv"
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, subject: deleteDialog.subject })}
        title="Supprimer la matière"
        description={`Êtes-vous sûr de vouloir supprimer la matière "${deleteDialog.subject?.name}" ? Cette action est irréversible.`}
        confirmText="Supprimer"
        variant="destructive"
        onConfirm={() => deleteDialog.subject && deleteMutation.mutate(deleteDialog.subject.id)}
      />
    </div>
  );
}