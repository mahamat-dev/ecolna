import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, patch, del } from '@/lib/api';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { DataGrid } from '@/components/DataGrid';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormField, Select } from '@/components/FormField';
import { Plus, Edit, Trash2, X, Home, BookOpen } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

interface Teacher extends Record<string, unknown> {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  userId: string;
}

interface ClassSection extends Record<string, unknown> {
  id: string;
  name: string;
  gradeLevel?: {
    name: string;
    stage?: {
      name: string;
    };
  };
}

interface Subject extends Record<string, unknown> {
  id: string;
  name: string;
  code: string;
}

interface AcademicYear extends Record<string, unknown> {
  id: string;
  name: string;
  isActive: boolean;
}

interface Assignment extends Record<string, unknown> {
  id: string;
  teacherProfileId: string;
  classSectionId: string;
  subjectId: string;
  academicYearId: string;
  isHomeroom: boolean;
  createdAt: string;
  teacher?: Teacher;
  classSection?: ClassSection;
  subject?: Subject;
  academicYear?: AcademicYear;
}

interface AssignmentFormData {
  teacherProfileId: string;
  classSectionId: string;
  subjectId: string;
  academicYearId: string;
  isHomeroom: boolean;
}

export function Assignments() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    assignment: Assignment | null;
  }>({ open: false, assignment: null });

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['teaching-assignments'],
    queryFn: () => get<Assignment[]>('teaching/assignments'),
  });

  const { data: teachers = [], isLoading: teachersLoading, error: teachersError } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => get<Teacher[]>('teaching/teachers'),
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['class-sections'],
    queryFn: () => get<ClassSection[]>('academics/class-sections'),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => get<Subject[]>('academics/subjects'),
  });

  const { data: academicYears = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => get<AcademicYear[]>('academics/academic-years'),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AssignmentFormData>({
    defaultValues: {
      isHomeroom: false
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: AssignmentFormData) => post('teaching/assignments', data),
    onSuccess: () => {
      toast.success('Affectation créée avec succès');
      queryClient.invalidateQueries({ queryKey: ['teaching-assignments'] });
      setIsCreateOpen(false);
      reset();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AssignmentFormData }) => 
      patch(`teaching/assignments/${id}`, data),
    onSuccess: () => {
      toast.success('Affectation mise à jour');
      queryClient.invalidateQueries({ queryKey: ['teaching-assignments'] });
      setEditingAssignment(null);
      reset();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => del(`teaching/assignments/${id}`),
    onSuccess: () => {
      toast.success('Affectation supprimée');
      queryClient.invalidateQueries({ queryKey: ['teaching-assignments'] });
      setDeleteDialog({ open: false, assignment: null });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const setHomeroomMutation = useMutation({
    mutationFn: ({ sectionId, teacherProfileId }: { sectionId: string; teacherProfileId: string }) => 
      post(`teaching/class-sections/${sectionId}/homeroom`, { teacherProfileId }),
    onSuccess: () => {
      toast.success('Professeur principal défini');
      queryClient.invalidateQueries({ queryKey: ['teaching-assignments'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const columns: ColumnDef<Assignment, unknown>[] = [
    {
      id: 'teacher',
      header: 'Enseignant',
      cell: ({ row }) => {
        const teacher = teachers.find(t => t.id === row.original.teacherProfileId);
        return teacher ? (
          <div>
            <div className="font-medium text-gray-900 dark:text-white">{teacher.firstName} {teacher.lastName}</div>
            {teacher.phone && (
              <div className="text-xs text-gray-500 dark:text-gray-400">{teacher.phone}</div>
            )}
          </div>
        ) : '-';
      },
    },
    {
      id: 'class',
      header: 'Classe',
      cell: ({ row }) => {
        const section = sections.find(s => s.id === row.original.classSectionId);
        return section ? (
          <div>
            <div className="font-medium text-gray-900 dark:text-white">{section.name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {section.gradeLevel?.name} - {section.gradeLevel?.stage?.name}
            </div>
          </div>
        ) : '-';
      },
    },
    {
      id: 'subject',
      header: 'Matière',
      cell: ({ row }) => {
        const subject = subjects.find(s => s.id === row.original.subjectId);
        return subject ? (
          <div>
            <div className="font-medium text-gray-900 dark:text-white">{subject.name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <code className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-0.5 rounded text-xs font-mono">{subject.code}</code>
            </div>
          </div>
        ) : '-';
      },
    },
    {
      id: 'academicYear',
      header: 'Année scolaire',
      cell: ({ row }) => {
        const year = academicYears.find(y => y.id === row.original.academicYearId);
        return year ? (
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-white">{year.name}</span>
            {year.isActive && (
              <span className="inline-flex px-2.5 py-0.5 bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-400 text-xs font-medium rounded-full">
                Active
              </span>
            )}
          </div>
        ) : '-';
      },
    },
    {
      accessorKey: 'isHomeroom',
      header: 'Prof. principal',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.isHomeroom ? (
            <>
              <Home className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              <span className="text-brand-600 dark:text-brand-400 text-sm font-medium">Oui</span>
            </>
          ) : (
            <span className="text-gray-500 dark:text-gray-400 text-sm">Non</span>
          )}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-1">
          {!row.original.isHomeroom && (
            <button
              onClick={() => setHomeroomMutation.mutate({
                sectionId: row.original.classSectionId,
                teacherProfileId: row.original.teacherProfileId
              })}
              className="p-2 text-brand-600 hover:text-brand-700 hover:bg-brand-50 dark:text-brand-400 dark:hover:text-brand-300 dark:hover:bg-brand-900/20 rounded-lg transition-colors"
              title="Définir comme professeur principal"
              disabled={setHomeroomMutation.isPending}
            >
              <Home className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => {
              setEditingAssignment(row.original);
              reset({
                teacherProfileId: row.original.teacherProfileId,
                classSectionId: row.original.classSectionId,
                subjectId: row.original.subjectId,
                academicYearId: row.original.academicYearId,
                isHomeroom: row.original.isHomeroom,
              });
            }}
            className="p-2 text-success-600 hover:text-success-700 hover:bg-success-50 dark:text-success-400 dark:hover:text-success-300 dark:hover:bg-success-900/20 rounded-lg transition-colors"
            title="Modifier"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDeleteDialog({ open: true, assignment: row.original })}
            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Supprimer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const onSubmit = (data: AssignmentFormData) => {
    if (editingAssignment) {
      updateMutation.mutate({ id: editingAssignment.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCancel = () => {
    setIsCreateOpen(false);
    setEditingAssignment(null);
    reset();
  };

  const isFormOpen = isCreateOpen || editingAssignment !== null;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const activeYear = academicYears.find(y => y.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Affectations d'enseignement</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gérer les affectations des enseignants aux classes et matières</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-colors duration-200 shadow-theme-sm hover:shadow-theme-md"
        >
          <Plus className="h-5 w-5" />
          Nouvelle affectation
        </button>
      </div>

      {/* Debug Information */}
      {teachersError && (
        <div className="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-xl p-6">
          <h3 className="text-error-800 dark:text-error-300 font-semibold mb-2">Erreur de chargement des enseignants</h3>
          <p className="text-error-700 dark:text-error-400 text-sm">{teachersError.message}</p>
        </div>
      )}

      {/* Data Summary */}
      <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-xl p-6">
        <h3 className="text-brand-800 dark:text-brand-300 font-semibold mb-4">État des données</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
          <div>
            <span className="text-brand-700 dark:text-brand-400 font-medium">Enseignants: </span>
            <span className="font-semibold text-gray-900 dark:text-white">{teachersLoading ? 'Chargement...' : teachers.length}</span>
          </div>
          <div>
            <span className="text-brand-700 dark:text-brand-400 font-medium">Classes: </span>
            <span className="font-semibold text-gray-900 dark:text-white">{sections.length}</span>
          </div>
          <div>
            <span className="text-brand-700 dark:text-brand-400 font-medium">Matières: </span>
            <span className="font-semibold text-gray-900 dark:text-white">{subjects.length}</span>
          </div>
          <div>
            <span className="text-brand-700 dark:text-brand-400 font-medium">Affectations: </span>
            <span className="font-semibold text-gray-900 dark:text-white">{assignments.length}</span>
          </div>
        </div>
      </div>

      {isFormOpen && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {editingAssignment ? 'Modifier l\'affectation' : 'Nouvelle affectation'}
            </h2>
            <button
              onClick={handleCancel}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Enseignant" required error={errors.teacherProfileId?.message}>
                <Select
                  {...register('teacherProfileId', { required: 'L\'enseignant est requis' })}
                  error={!!errors.teacherProfileId}
                >
                  <option value="">Sélectionner un enseignant</option>
                  {teachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.firstName} {teacher.lastName}
                      {teacher.phone && ` (${teacher.phone})`}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Classe" required error={errors.classSectionId?.message}>
                <Select
                  {...register('classSectionId', { required: 'La classe est requise' })}
                  error={!!errors.classSectionId}
                >
                  <option value="">Sélectionner une classe</option>
                  {sections.map(section => (
                    <option key={section.id} value={section.id}>
                      {section.name} ({section.gradeLevel?.name})
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Matière" required error={errors.subjectId?.message}>
                <Select
                  {...register('subjectId', { required: 'La matière est requise' })}
                  error={!!errors.subjectId}
                >
                  <option value="">Sélectionner une matière</option>
                  {subjects.map(subject => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name} ({subject.code})
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Année scolaire" required error={errors.academicYearId?.message}>
                <Select
                  {...register('academicYearId', { required: 'L\'année scolaire est requise' })}
                  error={!!errors.academicYearId}
                  defaultValue={activeYear?.id || ''}
                >
                  <option value="">Sélectionner une année</option>
                  {academicYears.map(year => (
                    <option key={year.id} value={year.id}>
                      {year.name} {year.isActive && '(Active)'}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            <FormField label="Professeur principal">
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  {...register('isHomeroom')}
                  className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                />
                <label className="text-sm text-gray-700 dark:text-gray-300">
                  Cet enseignant est le professeur principal de cette classe
                </label>
              </div>
            </FormField>
            <div className="flex gap-3 pt-6">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-medium rounded-xl transition-colors duration-200 disabled:cursor-not-allowed"
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
             data={assignments}
             csvName="affectations-enseignement.csv"
           />
        )}
      </div>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, assignment: deleteDialog.assignment })}
        title="Supprimer l'affectation"
        description={`Êtes-vous sûr de vouloir supprimer cette affectation ? Cette action est irréversible.`}
        confirmText="Supprimer"
        variant="destructive"
        onConfirm={() => deleteDialog.assignment && deleteMutation.mutate(deleteDialog.assignment.id)}
      />
    </div>
  );
}