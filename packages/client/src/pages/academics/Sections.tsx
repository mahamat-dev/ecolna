import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, patch, del } from '@/lib/api';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { DataGrid } from '@/components/DataGrid';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormField, Input, Select } from '@/components/FormField';
import { Plus, Edit, Trash2, X, BookOpen, Users } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

interface GradeLevel extends Record<string, unknown> {
  id: string;
  name: string;
  stage?: {
    name: string;
  };
}

interface Subject extends Record<string, unknown> {
  id: string;
  name: string;
  code: string;
}

interface ClassSection extends Record<string, unknown> {
  id: string;
  name: string;
  gradeLevelId: string;
  capacity: number;
  createdAt: string;
  updatedAt: string;
  gradeLevel?: GradeLevel;
}

interface SectionFormData {
  name: string;
  gradeLevelId: string;
  capacity: number;
}

interface ManageSubjectsDialogProps {
  section: ClassSection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ManageSubjectsDialog({ section, open, onOpenChange }: ManageSubjectsDialogProps) {
  const queryClient = useQueryClient();
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  const { data: allSubjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => get<Subject[]>('academics/subjects'),
  });

  const { data: sectionSubjects = [] } = useQuery({
    queryKey: ['section-subjects', section?.id],
    queryFn: () => get<Subject[]>(`academics/class-sections/${section?.id}/subjects`),
    enabled: !!section?.id && open,
  });

  const updateSubjectsMutation = useMutation({
    mutationFn: (subjectIds: string[]) => 
      post(`academics/class-sections/${section?.id}/subjects`, { subjectIds }),
    onSuccess: () => {
      toast.success('Matières mises à jour');
      queryClient.invalidateQueries({ queryKey: ['section-subjects', section?.id] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSave = () => {
    updateSubjectsMutation.mutate(selectedSubjects);
  };

  // Initialize selected subjects when dialog opens
  React.useEffect(() => {
    if (open && sectionSubjects.length > 0) {
      setSelectedSubjects(sectionSubjects.map(s => s.id));
    }
  }, [open, sectionSubjects]);

  if (!open || !section) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Gérer les matières - {section.name}</h2>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1 text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <div className="space-y-3">
            {allSubjects.map(subject => (
              <label key={subject.id} className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={selectedSubjects.includes(subject.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSubjects(prev => [...prev, subject.id]);
                    } else {
                      setSelectedSubjects(prev => prev.filter(id => id !== subject.id));
                    }
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <div className="flex-1">
                  <div className="font-medium">{subject.name}</div>
                  <div className="text-sm text-gray-500">
                    Code: <code className="bg-gray-100 px-1 rounded">{subject.code}</code>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
        
        <div className="p-6 border-t bg-gray-50">
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={updateSubjectsMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {updateSubjectsMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sections() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<ClassSection | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    section: ClassSection | null;
  }>({ open: false, section: null });
  const [subjectsDialog, setSubjectsDialog] = useState<{
    open: boolean;
    section: ClassSection | null;
  }>({ open: false, section: null });

  const { data: gradeLevels = [] } = useQuery({
    queryKey: ['grade-levels'],
    queryFn: () => get<GradeLevel[]>('academics/grade-levels'),
  });

  const { data: sections = [], isLoading } = useQuery({
    queryKey: ['class-sections'],
    queryFn: () => get<ClassSection[]>('academics/class-sections'),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SectionFormData>();

  const createMutation = useMutation({
    mutationFn: (data: SectionFormData) => post('academics/class-sections', data),
    onSuccess: () => {
      toast.success('Classe créée avec succès');
      queryClient.invalidateQueries({ queryKey: ['class-sections'] });
      setIsCreateOpen(false);
      reset();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SectionFormData }) => 
      patch(`academics/class-sections/${id}`, data),
    onSuccess: () => {
      toast.success('Classe mise à jour');
      queryClient.invalidateQueries({ queryKey: ['class-sections'] });
      setEditingSection(null);
      reset();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del(`academics/class-sections/${id}`),
    onSuccess: () => {
      toast.success('Classe supprimée');
      queryClient.invalidateQueries({ queryKey: ['class-sections'] });
      setDeleteDialog({ open: false, section: null });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const columns: ColumnDef<ClassSection, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Nom',
    },
    {
      id: 'gradeLevel',
      header: 'Niveau',
      cell: ({ row }) => {
        const gradeLevel = gradeLevels.find(gl => gl.id === row.original.gradeLevelId);
        return gradeLevel ? (
          <div>
            <div className="font-medium">{gradeLevel.name}</div>
            <div className="text-xs text-gray-500">{gradeLevel.stage?.name}</div>
          </div>
        ) : '-';
      },
    },
    {
      accessorKey: 'capacity',
      header: 'Capacité',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Users className="h-4 w-4 text-gray-400" />
          {row.original.capacity}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button
            onClick={() => setSubjectsDialog({ open: true, section: row.original })}
            className="p-1 text-green-600 hover:bg-green-50 rounded"
            title="Gérer les matières"
          >
            <BookOpen className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setEditingSection(row.original);
              reset({
                name: row.original.name,
                gradeLevelId: row.original.gradeLevelId,
                capacity: row.original.capacity,
              });
            }}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
            title="Modifier"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDeleteDialog({ open: true, section: row.original })}
            className="p-1 text-red-600 hover:bg-red-50 rounded"
            title="Supprimer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const onSubmit = (data: SectionFormData) => {
    if (editingSection) {
      updateMutation.mutate({ id: editingSection.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCancel = () => {
    setIsCreateOpen(false);
    setEditingSection(null);
    reset();
  };

  const isFormOpen = isCreateOpen || editingSection !== null;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Classes</h1>
          <p className="text-gray-600 mt-1">Gérer les classes et leurs matières</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nouvelle classe
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {editingSection ? 'Modifier la classe' : 'Nouvelle classe'}
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
                  placeholder="Ex: 6ème A, 1ère S1..."
                />
              </FormField>
              <FormField label="Niveau" required error={errors.gradeLevelId?.message}>
                <Select
                  {...register('gradeLevelId', { required: 'Le niveau est requis' })}
                  error={!!errors.gradeLevelId}
                >
                  <option value="">Sélectionner un niveau</option>
                  {gradeLevels.map(gradeLevel => (
                    <option key={gradeLevel.id} value={gradeLevel.id}>
                      {gradeLevel.name} ({gradeLevel.stage?.name})
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Capacité" required error={errors.capacity?.message}>
                <Input
                  {...register('capacity', { 
                    required: 'La capacité est requise',
                    valueAsNumber: true,
                    min: { value: 1, message: 'La capacité doit être supérieure à 0' }
                  })}
                  type="number"
                  min="1"
                  error={!!errors.capacity}
                  placeholder="30"
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
              data={sections}
              csvName="classes.csv"
            />
          </div>
        )}
      </div>

      <ManageSubjectsDialog
        section={subjectsDialog.section}
        open={subjectsDialog.open}
        onOpenChange={(open) => setSubjectsDialog({ open, section: subjectsDialog.section })}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, section: deleteDialog.section })}
        title="Supprimer la classe"
        description={`Êtes-vous sûr de vouloir supprimer la classe "${deleteDialog.section?.name}" ? Cette action est irréversible.`}
        confirmText="Supprimer"
        variant="destructive"
        onConfirm={() => deleteDialog.section && deleteMutation.mutate(deleteDialog.section.id)}
      />
    </div>
  );
}