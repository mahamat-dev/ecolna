import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, patch } from '@/lib/api';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { DataGrid } from '@/components/DataGrid';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormField, Input, Select } from '@/components/FormField';
import { Plus, CheckSquare, Lock, X, Calendar, Clock, Edit, Users } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

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

interface AttendanceSession extends Record<string, unknown> {
  id: string;
  classSectionId: string;
  subjectId: string;
  date: string;
  sessionDate?: string;
  startsAt: string;
  endsAt: string;
  startTime?: string;
  endTime?: string;
  isFinalized: boolean;
  createdAt: string;
  classSection?: ClassSection;
  subject?: Subject;
  _count?: {
    records: number;
  };
}

interface SessionFormData {
  classSectionId: string;
  subjectId: string;
  academicYearId: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
}

export function Sessions() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<AttendanceSession | null>(null);
  const [finalizeDialog, setFinalizeDialog] = useState<{
    open: boolean;
    session: AttendanceSession | null;
  }>({ open: false, session: null });

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['attendance-sessions'],
    queryFn: () => get<AttendanceSession[]>('attendance/sessions'),
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

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<SessionFormData>({
    defaultValues: {
      sessionDate: new Date().toISOString().split('T')[0],
      startTime: '08:00',
      endTime: '09:00',
      academicYearId: academicYears.find(y => y.isActive)?.id || ''
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: SessionFormData) => {
      // Transform client data to match server DTO
      const serverData = {
        classSectionId: data.classSectionId,
        subjectId: data.subjectId || null,
        academicYearId: data.academicYearId,
        date: data.sessionDate,
        startsAt: data.startTime,
        endsAt: data.endTime
      };
      return post('attendance/sessions', serverData);
    },
    onSuccess: () => {
      toast.success('Session créée avec succès');
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      setIsCreateOpen(false);
      reset();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SessionFormData }) => {
      const serverData = {
        classSectionId: data.classSectionId,
        subjectId: data.subjectId || null,
        academicYearId: data.academicYearId,
        date: data.sessionDate,
        startsAt: data.startTime,
        endsAt: data.endTime
      };
      return patch(`attendance/sessions/${id}`, serverData);
    },
    onSuccess: () => {
      toast.success('Session modifiée avec succès');
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      setEditingSession(null);
      reset();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: (sessionId: string) => patch(`attendance/sessions/${sessionId}/finalize`, {}),
    onSuccess: () => {
      toast.success('Session finalisée');
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      setFinalizeDialog({ open: false, session: null });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const columns: ColumnDef<AttendanceSession, unknown>[] = [
    {
      id: 'class',
      header: 'Classe',
      cell: ({ row }) => {
        const section = sections.find(s => s.id === row.original.classSectionId);
        return section ? (
          <div>
            <div className="font-medium">{section.name}</div>
            <div className="text-xs text-gray-500">
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
            <div className="font-medium">{subject.name}</div>
            <div className="text-xs text-gray-500">
              <code className="bg-gray-100 px-1 rounded">{subject.code}</code>
            </div>
          </div>
        ) : '-';
      },
    },
    {
      id: 'date',
      header: 'Date',
      cell: ({ row }) => {
        const dateStr = row.original.date || row.original.sessionDate;
        return (
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4 text-gray-400" />
            {dateStr ? new Date(dateStr).toLocaleDateString('fr-FR') : '-'}
          </div>
        );
      },
    },
    {
      id: 'time',
      header: 'Horaire',
      cell: ({ row }) => {
        const startTime = row.original.startsAt || row.original.startTime;
        const endTime = row.original.endsAt || row.original.endTime;
        return (
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-gray-400" />
            <span className="text-sm">
              {startTime && endTime ? `${startTime} - ${endTime}` : '-'}
            </span>
          </div>
        );
      },
    },
    {
      id: 'attendance',
      header: 'Présences',
      cell: ({ row }) => (
        <div className="text-sm">
          {row.original._count?.records || 0} enregistrements
        </div>
      ),
    },
    {
      accessorKey: 'isFinalized',
      header: 'Statut',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {row.original.isFinalized ? (
            <>
              <Lock className="h-4 w-4 text-green-600" />
              <span className="text-green-600 text-sm">Finalisée</span>
            </>
          ) : (
            <>
              <CheckSquare className="h-4 w-4 text-orange-600" />
              <span className="text-orange-600 text-sm">En cours</span>
            </>
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
            onClick={() => {
              const sessionDate = row.original.date || row.original.sessionDate;
              const url = `/attendance/take?classSectionId=${row.original.classSectionId}&subjectId=${row.original.subjectId}&sessionDate=${sessionDate}`;
              window.open(url, '_blank');
            }}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
            title="Prendre la présence"
          >
            <Users className="h-4 w-4" />
          </button>
          {!row.original.isFinalized && (
            <>
              <button
                onClick={() => handleEdit(row.original)}
                className="p-1 text-orange-600 hover:bg-orange-50 rounded"
                title="Modifier la session"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={() => setFinalizeDialog({ open: true, session: row.original })}
                className="p-1 text-green-600 hover:bg-green-50 rounded"
                title="Finaliser la session"
              >
                <Lock className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const onSubmit = (data: SessionFormData) => {
    if (editingSession) {
      updateMutation.mutate({ id: editingSession.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCancel = () => {
    setIsCreateOpen(false);
    setEditingSession(null);
    reset();
  };

  const handleEdit = (session: AttendanceSession) => {
    setEditingSession(session);
    setIsCreateOpen(true);
    // Populate form with session data
    setValue('classSectionId', session.classSectionId);
    setValue('subjectId', session.subjectId);
    setValue('sessionDate', session.date || session.sessionDate || '');
    setValue('startTime', session.startsAt || session.startTime || '');
    setValue('endTime', session.endsAt || session.endTime || '');
    // Find and set academic year - this might need to be fetched from session data
    const activeYear = academicYears.find(y => y.isActive);
    if (activeYear) {
      setValue('academicYearId', activeYear.id);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Sessions de présence</h1>
          <p className="text-gray-600 mt-1">Gérer les sessions de prise de présence</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nouvelle session
        </button>
      </div>

      {isCreateOpen && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              {editingSession ? 'Modifier la session de présence' : 'Créer une session de présence'}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Date" required error={errors.sessionDate?.message}>
                <Input
                  type="date"
                  {...register('sessionDate', { required: 'La date est requise' })}
                  error={!!errors.sessionDate}
                />
              </FormField>
              <FormField label="Heure de début" required error={errors.startTime?.message}>
                <Input
                  type="time"
                  {...register('startTime', { required: 'L\'heure de début est requise' })}
                  error={!!errors.startTime}
                />
              </FormField>
              <FormField label="Heure de fin" required error={errors.endTime?.message}>
                <Input
                  type="time"
                  {...register('endTime', { required: 'L\'heure de fin est requise' })}
                  error={!!errors.endTime}
                />
              </FormField>
            </div>
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? (editingSession ? 'Modification...' : 'Création...') : (editingSession ? 'Modifier la session' : 'Créer la session')}
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
              data={sessions}
              csvName="sessions-presence.csv"
            />
        )}
      </div>

      <ConfirmDialog
        open={finalizeDialog.open}
        onOpenChange={(open) => setFinalizeDialog({ open, session: finalizeDialog.session })}
        title="Finaliser la session"
        description="Êtes-vous sûr de vouloir finaliser cette session ? Une fois finalisée, les présences ne pourront plus être modifiées."
        confirmText="Finaliser"
        onConfirm={() => finalizeDialog.session && finalizeMutation.mutate(finalizeDialog.session.id)}
      />
    </div>
  );
}