import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, patch, del } from '@/lib/api';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { DataGrid } from '@/components/DataGrid';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormField, Input, Select } from '@/components/FormField';
import { Plus, Edit, Trash2, X } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

interface EducationStage extends Record<string, unknown> {
  id: string;
  name: string;
}

interface GradeLevel extends Record<string, unknown> {
  id: string;
  name: string;
  stageId: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  stage?: EducationStage;
}

interface GradeLevelFormData {
  name: string;
  stageId: string;
  sortOrder: number;
}

export function GradeLevels() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingGradeLevel, setEditingGradeLevel] = useState<GradeLevel | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    gradeLevel: GradeLevel | null;
  }>({ open: false, gradeLevel: null });

  const { data: stages = [] } = useQuery({
    queryKey: ['education-stages'],
    queryFn: () => get<EducationStage[]>('academics/education-stages'),
  });

  const { data: gradeLevels = [], isLoading } = useQuery({
    queryKey: ['grade-levels'],
    queryFn: () => get<GradeLevel[]>('academics/grade-levels'),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<GradeLevelFormData>();

  const createMutation = useMutation({
    mutationFn: (data: GradeLevelFormData) => post('academics/grade-levels', data),
    onSuccess: () => {
      toast.success('Niveau créé avec succès');
      queryClient.invalidateQueries({ queryKey: ['grade-levels'] });
      setIsCreateOpen(false);
      reset();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: GradeLevelFormData }) => 
      patch(`academics/grade-levels/${id}`, data),
    onSuccess: () => {
      toast.success('Niveau mis à jour');
      queryClient.invalidateQueries({ queryKey: ['grade-levels'] });
      setEditingGradeLevel(null);
      reset();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del(`academics/grade-levels/${id}`),
    onSuccess: () => {
      toast.success('Niveau supprimé');
      queryClient.invalidateQueries({ queryKey: ['grade-levels'] });
      setDeleteDialog({ open: false, gradeLevel: null });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const columns: ColumnDef<GradeLevel, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Nom',
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
      accessorKey: 'sortOrder',
      header: 'Ordre',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingGradeLevel(row.original);
              reset({
                name: row.original.name,
                stageId: row.original.stageId,
                sortOrder: row.original.sortOrder,
              });
            }}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
            title="Modifier"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDeleteDialog({ open: true, gradeLevel: row.original })}
            className="p-1 text-red-600 hover:bg-red-50 rounded"
            title="Supprimer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const onSubmit = (data: GradeLevelFormData) => {
    if (editingGradeLevel) {
      updateMutation.mutate({ id: editingGradeLevel.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCancel = () => {
    setIsCreateOpen(false);
    setEditingGradeLevel(null);
    reset();
  };

  const isFormOpen = isCreateOpen || editingGradeLevel !== null;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Niveaux scolaires</h1>
          <p className="text-gray-600 mt-1">Gérer les niveaux par étape d'éducation</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nouveau niveau
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {editingGradeLevel ? 'Modifier le niveau' : 'Nouveau niveau'}
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
                  placeholder="Ex: 6ème, 1ère..."
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
              data={gradeLevels}
              csvName="niveaux-scolaires.csv"
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, gradeLevel: deleteDialog.gradeLevel })}
        title="Supprimer le niveau"
        description={`Êtes-vous sûr de vouloir supprimer le niveau "${deleteDialog.gradeLevel?.name}" ? Cette action est irréversible.`}
        confirmText="Supprimer"
        variant="destructive"
        onConfirm={() => deleteDialog.gradeLevel && deleteMutation.mutate(deleteDialog.gradeLevel.id)}
      />
    </div>
  );
}