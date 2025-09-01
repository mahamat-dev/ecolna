import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, patch, del } from '@/lib/api';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { DataGrid } from '@/components/DataGrid';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormField, Input, Textarea } from '@/components/FormField';
import { Plus, Edit, Trash2, X } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

interface EducationStage extends Record<string, unknown> {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface StageFormData {
  name: string;
  description?: string;
  sortOrder: number;
}

export function Stages() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<EducationStage | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    stage: EducationStage | null;
  }>({ open: false, stage: null });

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ['education-stages'],
    queryFn: () => get<EducationStage[]>('academics/education-stages'),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<StageFormData>();

  const createMutation = useMutation({
    mutationFn: (data: StageFormData) => post('academics/education-stages', data),
    onSuccess: () => {
      toast.success('Étape créée avec succès');
      queryClient.invalidateQueries({ queryKey: ['education-stages'] });
      setIsCreateOpen(false);
      reset();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: StageFormData }) => 
      patch(`academics/education-stages/${id}`, data),
    onSuccess: () => {
      toast.success('Étape mise à jour');
      queryClient.invalidateQueries({ queryKey: ['education-stages'] });
      setEditingStage(null);
      reset();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del(`academics/education-stages/${id}`),
    onSuccess: () => {
      toast.success('Étape supprimée');
      queryClient.invalidateQueries({ queryKey: ['education-stages'] });
      setDeleteDialog({ open: false, stage: null });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const columns: ColumnDef<EducationStage, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Nom',
      cell: ({ row }) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {row.original.name}
        </span>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => (
        <span className="text-gray-600 dark:text-gray-400">
          {row.original.description || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'sortOrder',
      header: 'Ordre',
      cell: ({ row }) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800 dark:bg-brand-900/20 dark:text-brand-400">
          {row.original.sortOrder}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button
            onClick={() => {
              setEditingStage(row.original);
              reset({
                name: row.original.name,
                description: row.original.description || '',
                sortOrder: row.original.sortOrder,
              });
            }}
            className="p-2 text-brand-600 hover:text-brand-700 hover:bg-brand-50 dark:text-brand-400 dark:hover:text-brand-300 dark:hover:bg-brand-900/20 rounded-lg transition-colors"
            title="Modifier"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDeleteDialog({ open: true, stage: row.original })}
            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Supprimer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const onSubmit = (data: StageFormData) => {
    if (editingStage) {
      updateMutation.mutate({ id: editingStage.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCancel = () => {
    setIsCreateOpen(false);
    setEditingStage(null);
    reset();
  };

  const isFormOpen = isCreateOpen || editingStage !== null;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Étapes d'éducation</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gérer les étapes du système éducatif</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-colors duration-200 shadow-theme-sm hover:shadow-theme-md"
        >
          <Plus className="h-5 w-5" />
          Nouvelle étape
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {editingStage ? 'Modifier l\'étape' : 'Nouvelle étape'}
            </h2>
            <button
              onClick={handleCancel}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="Nom" required error={errors.name?.message}>
                <Input
                  {...register('name', { required: 'Le nom est requis' })}
                  error={!!errors.name}
                  placeholder="Ex: Primaire, Secondaire..."
                />
              </FormField>
              <FormField label="Ordre" required error={errors.sortOrder?.message}>
                <Input
                  {...register('sortOrder', { 
                    required: 'L\'ordre est requis',
                    valueAsNumber: true,
                    min: { value: 1, message: 'L\'ordre doit être supérieur à 0' }
                  })}
                  type="number"
                  min="1"
                  error={!!errors.sortOrder}
                  placeholder="1"
                />
              </FormField>
            </div>
            <FormField label="Description">
              <Textarea
                {...register('description')}
                placeholder="Description de l'étape d'éducation..."
                rows={3}
              />
            </FormField>
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-medium rounded-xl transition-colors duration-200 shadow-theme-sm hover:shadow-theme-md disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors duration-200"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
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
              data={stages}
              csvName="etapes-education.csv"
            />
        )}
      </div>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, stage: deleteDialog.stage })}
        title="Supprimer l'étape"
        description={`Êtes-vous sûr de vouloir supprimer l'étape "${deleteDialog.stage?.name}" ? Cette action est irréversible.`}
        confirmText="Supprimer"
        variant="destructive"
        onConfirm={() => deleteDialog.stage && deleteMutation.mutate(deleteDialog.stage.id)}
      />
    </div>
  );
}