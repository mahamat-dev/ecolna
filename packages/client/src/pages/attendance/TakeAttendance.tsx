import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post } from '@/lib/api';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { FormField, Select } from '@/components/FormField';
import { CheckSquare, UserCheck, UserX, Clock, Users, Save } from 'lucide-react';

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

interface Student extends Record<string, unknown> {
  id: string;
  firstName: string;
  lastName: string;
  rollNo?: string;
  userId: string;
  enrollmentId?: string;
}

interface AttendanceRecord {
  studentProfileId: string;
  enrollmentId?: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  remarks?: string;
  comment?: string;
}

interface BulkMarkRecord {
  enrollmentId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  comment?: string;
  minutesLate?: number;
}

interface RosterFormData {
  classSectionId: string;
  subjectId: string;
  sessionDate: string;
}

interface AttendanceSession {
  id: string;
  classSectionId: string;
  subjectId: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  isFinalized: boolean;
}

export function TakeAttendance() {
  const queryClient = useQueryClient();
  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(null);
  const [roster, setRoster] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);

  const { data: sections = [] } = useQuery({
    queryKey: ['class-sections'],
    queryFn: () => get<ClassSection[]>('academics/class-sections'),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => get<Subject[]>('academics/subjects'),
  });

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RosterFormData>({
    defaultValues: {
      sessionDate: new Date().toISOString().split('T')[0]
    }
  });

  const watchedValues = watch();

  const saveAttendanceMutation = useMutation({
    mutationFn: ({ sessionId, records }: { sessionId: string; records: BulkMarkRecord[] }) => 
      post(`attendance/sessions/${sessionId}/bulk-mark`, { records }),
    onSuccess: () => {
      toast.success('Présences enregistrées avec succès');
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const loadRoster = async (data: RosterFormData) => {
    if (!data.classSectionId || !data.subjectId || !data.sessionDate) return;

    setIsLoadingRoster(true);
    try {
      // First, try to find or create a session
      const sessions = await get<AttendanceSession[]>(
        `attendance/sessions?classSectionId=${data.classSectionId}&subjectId=${data.subjectId}&date=${data.sessionDate}`
      );
      
      let session = sessions.find(s => 
        s.classSectionId === data.classSectionId && 
        s.subjectId === data.subjectId && 
        s.sessionDate === data.sessionDate
      );

      if (!session) {
        // Get active academic year for session creation
        const academicYears = await get<{id: string; isActive: boolean}[]>('academics/academic-years');
        const activeYear = academicYears.find(y => y.isActive);
        
        if (!activeYear) {
          throw new Error('Aucune année scolaire active trouvée');
        }

        // Create a new session with proper data format
        session = await post<AttendanceSession>('attendance/sessions', {
          classSectionId: data.classSectionId,
          subjectId: data.subjectId,
          academicYearId: activeYear.id,
          date: data.sessionDate,
          startsAt: new Date().toTimeString().slice(0, 5),
          endsAt: new Date(Date.now() + 60 * 60 * 1000).toTimeString().slice(0, 5)
        });
        toast.success('Nouvelle session créée');
      }

      setSelectedSession(session);

      // Load the roster
      const rosterData = await get<Student[]>(
        `enrollment/class-sections/${data.classSectionId}/students`
      );
      setRoster(rosterData);

      // Initialize attendance records for all students
      const initialAttendance: Record<string, AttendanceRecord> = {};
      rosterData.forEach(student => {
        initialAttendance[student.id] = {
          studentProfileId: student.id,
          enrollmentId: student.enrollmentId,
          status: 'PRESENT',
          remarks: '',
          comment: ''
        };
      });

      // Load existing attendance records if any and override defaults
      try {
        const existingRecords = await get<AttendanceRecord[]>(
          `attendance/sessions/${session.id}/records`
        );
        existingRecords.forEach(record => {
          if (initialAttendance[record.studentProfileId]) {
            initialAttendance[record.studentProfileId] = record;
          }
        });
      } catch {
        // No existing records, use initial defaults
        console.log('No existing attendance records found, using defaults');
      }
      
      setAttendance(initialAttendance);
    } catch (error) {
      toast.error('Erreur lors du chargement de la liste');
      console.error(error);
    } finally {
      setIsLoadingRoster(false);
    }
  };

  const updateAttendance = (studentId: string, status: AttendanceRecord['status']) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status
      }
    }));
  };

  const updateRemarks = (studentId: string, remarks: string) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        remarks
      }
    }));
  };

  const saveAttendance = () => {
    if (!selectedSession) return;
    
    // Transform client data to match server DTO
    const records: BulkMarkRecord[] = Object.values(attendance)
      .filter(record => record.enrollmentId || record.studentProfileId)
      .map(record => ({
        enrollmentId: record.enrollmentId || record.studentProfileId,
        status: record.status,
        comment: record.remarks || record.comment,
        minutesLate: record.status === 'LATE' ? 0 : undefined
      })) as BulkMarkRecord[];
    
    saveAttendanceMutation.mutate({
      sessionId: selectedSession.id,
      records
    });
  };

  const getStatusColor = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'PRESENT': return 'bg-success-100 text-success-800 border-success-200 dark:bg-success-900/20 dark:text-success-400 dark:border-success-800';
      case 'ABSENT': return 'bg-error-100 text-error-800 border-error-200 dark:bg-error-900/20 dark:text-error-400 dark:border-error-800';
      case 'LATE': return 'bg-warning-100 text-warning-800 border-warning-200 dark:bg-warning-900/20 dark:text-warning-400 dark:border-warning-800';
      case 'EXCUSED': return 'bg-brand-100 text-brand-800 border-brand-200 dark:bg-brand-900/20 dark:text-brand-400 dark:border-brand-800';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
    }
  };

  const getStatusIcon = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'PRESENT': return <UserCheck className="h-4 w-4" />;
      case 'ABSENT': return <UserX className="h-4 w-4" />;
      case 'LATE': return <Clock className="h-4 w-4" />;
      case 'EXCUSED': return <CheckSquare className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const statusOptions = [
    { value: 'PRESENT', label: 'Présent' },
    { value: 'ABSENT', label: 'Absent' },
    { value: 'LATE', label: 'En retard' },
    { value: 'EXCUSED', label: 'Excusé' }
  ];

  const presentCount = Object.values(attendance).filter(a => a.status === 'PRESENT').length;
  const absentCount = Object.values(attendance).filter(a => a.status === 'ABSENT').length;
  const lateCount = Object.values(attendance).filter(a => a.status === 'LATE').length;
  const excusedCount = Object.values(attendance).filter(a => a.status === 'EXCUSED').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Prendre la présence</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Marquer la présence des étudiants pour une classe et matière</p>
      </div>

      {/* Roster Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Sélectionner la classe et matière
        </h2>
        
        <form onSubmit={handleSubmit(loadRoster)} className="space-y-4">
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
            <FormField label="Date" required error={errors.sessionDate?.message}>
              <input
                type="date"
                {...register('sessionDate', { required: 'La date est requise' })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </FormField>
          </div>
          <button
            type="submit"
            disabled={isLoadingRoster || !watchedValues.classSectionId || !watchedValues.subjectId}
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-medium rounded-xl transition-colors duration-200 disabled:cursor-not-allowed"
          >
            {isLoadingRoster ? 'Chargement...' : 'Charger la liste'}
          </button>
        </form>
      </div>



      {/* Summary Cards */}
      {roster.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Résumé de la présence</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-xl">
              <div className="text-3xl font-bold text-success-600 dark:text-success-400">{presentCount}</div>
              <div className="text-sm font-medium text-success-600 dark:text-success-400 mt-1">Présents</div>
            </div>
            <div className="text-center p-4 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-xl">
              <div className="text-3xl font-bold text-error-600 dark:text-error-400">{absentCount}</div>
              <div className="text-sm font-medium text-error-600 dark:text-error-400 mt-1">Absents</div>
            </div>
            <div className="text-center p-4 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-xl">
              <div className="text-3xl font-bold text-warning-600 dark:text-warning-400">{lateCount}</div>
              <div className="text-sm font-medium text-warning-600 dark:text-warning-400 mt-1">En retard</div>
            </div>
            <div className="text-center p-4 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-xl">
              <div className="text-3xl font-bold text-brand-600 dark:text-brand-400">{excusedCount}</div>
              <div className="text-sm font-medium text-brand-600 dark:text-brand-400 mt-1">Excusés</div>
            </div>
          </div>
        </div>
      )}

      {/* Attendance List */}
      {roster.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Liste de présence</h3>
              <button
                onClick={saveAttendance}
                disabled={saveAttendanceMutation.isPending || selectedSession?.isFinalized}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-success-600 hover:bg-success-700 disabled:bg-success-400 text-white font-medium rounded-xl transition-colors duration-200 disabled:cursor-not-allowed"
              >
                <Save className="h-5 w-5" />
                {saveAttendanceMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
            {selectedSession?.isFinalized && (
              <div className="mt-4 p-3 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg">
                <p className="text-warning-800 dark:text-warning-400 text-sm">
                  ⚠️ Cette session est finalisée. Les modifications ne sont plus possibles.
                </p>
              </div>
            )}
          </div>
          
          <div className="p-6">
            <div className="space-y-3">
              {roster.map(student => {
                const studentAttendance = attendance[student.id];
                if (!studentAttendance) return null;
                
                return (
                  <div key={student.id} className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-750">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {student.firstName} {student.lastName}
                      </div>
                      {student.rollNo && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">N° {student.rollNo}</div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      {statusOptions.map(option => (
                        <button
                          key={option.value}
                          onClick={() => updateAttendance(student.id, option.value as AttendanceRecord['status'])}
                          disabled={selectedSession?.isFinalized}
                          className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                            studentAttendance.status === option.value
                              ? getStatusColor(option.value as AttendanceRecord['status'])
                              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          <div className="flex items-center gap-1">
                            {studentAttendance.status === option.value && getStatusIcon(option.value as AttendanceRecord['status'])}
                            {option.label}
                          </div>
                        </button>
                      ))}
                    </div>
                    
                    <div className="w-48">
                      <input
                        type="text"
                        placeholder="Remarques..."
                        value={studentAttendance.remarks || ''}
                        onChange={(e) => updateRemarks(student.id, e.target.value)}
                        disabled={selectedSession?.isFinalized}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-gray-100 dark:disabled:bg-gray-700"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {roster.length === 0 && !isLoadingRoster && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Users className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Aucune liste chargée</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Sélectionnez une classe, une matière et une date pour charger la liste des étudiants.
          </p>
        </div>
      )}
    </div>
  );
}