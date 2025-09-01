import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post } from '@/lib/api';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { DataGrid } from '@/components/DataGrid';
import { FormField, Input, Select } from '@/components/FormField';
import { Plus, UserPlus, ArrowRightLeft, UserMinus, X } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

interface Student extends Record<string, unknown> {
  id: string;
  firstName: string;
  lastName: string;
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

interface AcademicYear extends Record<string, unknown> {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface Enrollment extends Record<string, unknown> {
  id: string;
  studentProfileId: string;
  classSectionId: string;
  academicYearId: string;
  enrollmentDate: string;
  status: 'ACTIVE' | 'TRANSFERRED' | 'WITHDRAWN' | 'GRADUATED';
  rollNo?: string;
  student?: Student;
  classSection?: ClassSection;
  academicYear?: AcademicYear;
}

interface EnrollFormData {
  studentProfileId: string;
  classSectionId: string;
  academicYearId: string;
}

interface TransferFormData {
  enrollmentId: string;
  newClassSectionId: string;
  transferDate: string;
  reason?: string;
}

interface WithdrawFormData {
  studentProfileId: string;
  classSectionId: string;
  academicYearId: string;
  withdrawDate: string;
  reason?: string;
}

export function Enrollments() {
  const queryClient = useQueryClient();
  const [activeDialog, setActiveDialog] = useState<'enroll' | 'transfer' | 'withdraw' | null>(null);
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ['enrollments'],
    queryFn: () => get<Enrollment[]>('enrollment/enrollments'),
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => get<Student[]>('enrollment/students'),
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['class-sections'],
    queryFn: () => get<ClassSection[]>('academics/class-sections'),
  });

  const { data: academicYears = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => get<AcademicYear[]>('academics/academic-years'),
  });

  const { register: registerEnroll, handleSubmit: handleEnrollSubmit, reset: resetEnroll, formState: { errors: enrollErrors } } = useForm<EnrollFormData>();
  const { register: registerTransfer, handleSubmit: handleTransferSubmit, reset: resetTransfer, formState: { errors: transferErrors } } = useForm<TransferFormData>();
  const { register: registerWithdraw, handleSubmit: handleWithdrawSubmit, reset: resetWithdraw, formState: { errors: withdrawErrors } } = useForm<WithdrawFormData>();

  const enrollMutation = useMutation({
    mutationFn: (data: EnrollFormData) => post('enrollment/enrollments', data),
    onSuccess: () => {
      toast.success('Étudiant inscrit avec succès');
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      setActiveDialog(null);
      resetEnroll();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const transferMutation = useMutation({
    mutationFn: (data: TransferFormData) => post('enrollment/enrollments/transfer', {
      enrollmentId: data.enrollmentId,
      newClassSectionId: data.newClassSectionId,
      transferDate: data.transferDate,
      reason: data.reason,
    }),
    onSuccess: () => {
      toast.success('Étudiant transféré avec succès');
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      setActiveDialog(null);
      resetTransfer();
      setSelectedEnrollment(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (data: WithdrawFormData) => post('enrollment/enrollments/withdraw', {
      studentProfileId: data.studentProfileId,
      classSectionId: data.classSectionId,
      academicYearId: data.academicYearId,
      exitedOn: data.withdrawDate,
      reason: data.reason,
    }),
    onSuccess: () => {
      toast.success('Étudiant retiré avec succès');
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      setActiveDialog(null);
      resetWithdraw();
      setSelectedEnrollment(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const columns: ColumnDef<Enrollment, unknown>[] = [
    {
      id: 'student',
      header: 'Étudiant',
      cell: ({ row }) => {
        const student = students.find(s => s.id === row.original.studentProfileId);
        return student ? `${student.firstName} ${student.lastName}` : '-';
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
      id: 'academicYear',
      header: 'Année scolaire',
      cell: ({ row }) => {
        const year = academicYears.find(y => y.id === row.original.academicYearId);
        return year?.name || '-';
      },
    },
    {
      accessorKey: 'rollNo',
      header: 'N° Matricule',
      cell: ({ row }) => row.original.rollNo || '-',
    },
    {
      accessorKey: 'status',
      header: 'Statut',
      cell: ({ row }) => {
        const status = row.original.status;
        const statusColors = {
          ACTIVE: 'bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-400',
          TRANSFERRED: 'bg-brand-100 text-brand-800 dark:bg-brand-900/20 dark:text-brand-400',
          WITHDRAWN: 'bg-error-100 text-error-800 dark:bg-error-900/20 dark:text-error-400',
          GRADUATED: 'bg-brand-100 text-brand-800 dark:bg-brand-900/20 dark:text-brand-400',
        };
        const statusLabels = {
          ACTIVE: 'Actif',
          TRANSFERRED: 'Transféré',
          WITHDRAWN: 'Retiré',
          GRADUATED: 'Diplômé',
        };
        return (
          <span className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${statusColors[status as keyof typeof statusColors]}`}>
            {statusLabels[status as keyof typeof statusLabels]}
          </span>
        );
      },
    },
    {
      accessorKey: 'enrollmentDate',
      header: 'Date d\'inscription',
      cell: ({ row }) => new Date(row.original.enrollmentDate).toLocaleDateString('fr-FR'),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const isActive = row.original.status === 'ACTIVE';
        return (
          <div className="flex gap-1">
            {isActive && (
              <>
                <button
                  onClick={() => {
                    setSelectedEnrollment(row.original);
                    setActiveDialog('transfer');
                    resetTransfer({ enrollmentId: row.original.id });
                  }}
                  className="p-2 text-brand-600 hover:text-brand-700 hover:bg-brand-50 dark:text-brand-400 dark:hover:text-brand-300 dark:hover:bg-brand-900/20 rounded-lg transition-colors"
                  title="Transférer"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setSelectedEnrollment(row.original);
                    setActiveDialog('withdraw');
                    resetWithdraw({ 
          studentProfileId: row.original.studentProfileId,
          classSectionId: row.original.classSectionId,
          academicYearId: row.original.academicYearId
        });
                  }}
                  className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Retirer"
                >
                  <UserMinus className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  const onEnrollSubmit = (data: EnrollFormData) => {
    enrollMutation.mutate(data);
  };

  const onTransferSubmit = (data: TransferFormData) => {
    transferMutation.mutate(data);
  };

  const onWithdrawSubmit = (data: WithdrawFormData) => {
    withdrawMutation.mutate(data);
  };

  const handleCloseDialog = () => {
    setActiveDialog(null);
    setSelectedEnrollment(null);
    resetEnroll();
    resetTransfer();
    resetWithdraw();
  };

  const activeYear = academicYears.find(y => y.isActive);
  const availableStudents = students.filter(student => 
    !enrollments.some(enrollment => 
      enrollment.studentProfileId === student.id && 
      enrollment.status === 'ACTIVE'
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Inscriptions</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gérer les inscriptions des étudiants</p>
        </div>
        <button
          onClick={() => setActiveDialog('enroll')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-colors duration-200 shadow-theme-sm hover:shadow-theme-md"
        >
          <Plus className="h-5 w-5" />
          Nouvelle inscription
        </button>
      </div>

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
            data={enrollments}
            csvName="inscriptions.csv"
          />
        )}
      </div>

      {/* Enroll Dialog */}
      {activeDialog === 'enroll' && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Nouvelle inscription
                </h2>
                <button onClick={handleCloseDialog} className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <form onSubmit={handleEnrollSubmit(onEnrollSubmit)} className="p-6 space-y-4">
              <FormField label="Étudiant" required error={enrollErrors.studentProfileId?.message}>
                <Select
                  {...registerEnroll('studentProfileId', { required: 'L\'étudiant est requis' })}
                  error={!!enrollErrors.studentProfileId}
                >
                  <option value="">Sélectionner un étudiant</option>
                  {availableStudents.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.firstName} {student.lastName}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Classe" required error={enrollErrors.classSectionId?.message}>
                <Select
                  {...registerEnroll('classSectionId', { required: 'La classe est requise' })}
                  error={!!enrollErrors.classSectionId}
                >
                  <option value="">Sélectionner une classe</option>
                  {sections.map(section => (
                    <option key={section.id} value={section.id}>
                      {section.name} ({section.gradeLevel?.name})
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Année scolaire" required error={enrollErrors.academicYearId?.message}>
                <Select
                  {...registerEnroll('academicYearId', { required: 'L\'année scolaire est requise' })}
                  error={!!enrollErrors.academicYearId}
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
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={enrollMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-medium rounded-xl transition-colors duration-200 disabled:cursor-not-allowed"
                >
                  {enrollMutation.isPending ? 'Inscription...' : 'Inscrire'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseDialog}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors duration-200"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Dialog */}
      {activeDialog === 'transfer' && selectedEnrollment && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5" />
                  Transférer l'étudiant
                </h2>
                <button onClick={handleCloseDialog} className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <form onSubmit={handleTransferSubmit(onTransferSubmit)} className="p-6 space-y-4">
              <input type="hidden" {...registerTransfer('enrollmentId')} />
              <FormField label="Nouvelle classe" required error={transferErrors.newClassSectionId?.message}>
                <Select
                  {...registerTransfer('newClassSectionId', { required: 'La nouvelle classe est requise' })}
                  error={!!transferErrors.newClassSectionId}
                >
                  <option value="">Sélectionner une classe</option>
                  {sections.filter(s => s.id !== selectedEnrollment.classSectionId).map(section => (
                    <option key={section.id} value={section.id}>
                      {section.name} ({section.gradeLevel?.name})
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Date de transfert" required error={transferErrors.transferDate?.message}>
                <Input
                  type="date"
                  {...registerTransfer('transferDate', { required: 'La date est requise' })}
                  error={!!transferErrors.transferDate}
                  defaultValue={new Date().toISOString().split('T')[0]}
                />
              </FormField>
              <FormField label="Raison (optionnel)">
                <Input
                  {...registerTransfer('reason')}
                  placeholder="Raison du transfert..."
                />
              </FormField>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={transferMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white font-medium rounded-xl transition-colors duration-200 disabled:cursor-not-allowed"
                >
                  {transferMutation.isPending ? 'Transfert...' : 'Transférer'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseDialog}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors duration-200"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Withdraw Dialog */}
      {activeDialog === 'withdraw' && selectedEnrollment && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <UserMinus className="h-5 w-5" />
                  Retirer l'étudiant
                </h2>
                <button onClick={handleCloseDialog} className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <form onSubmit={handleWithdrawSubmit(onWithdrawSubmit)} className="p-6 space-y-4">
              <input type="hidden" {...registerWithdraw('studentProfileId')} />
                <input type="hidden" {...registerWithdraw('classSectionId')} />
                <input type="hidden" {...registerWithdraw('academicYearId')} />
              <FormField label="Date de retrait" required error={withdrawErrors.withdrawDate?.message}>
                <Input
                  type="date"
                  {...registerWithdraw('withdrawDate', { required: 'La date est requise' })}
                  error={!!withdrawErrors.withdrawDate}
                  defaultValue={new Date().toISOString().split('T')[0]}
                />
              </FormField>
              <FormField label="Raison (optionnel)">
                <Input
                  {...registerWithdraw('reason')}
                  placeholder="Raison du retrait..."
                />
              </FormField>
              <div className="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg p-4">
                <p className="text-sm text-error-800 dark:text-error-400">
                  ⚠️ Cette action retirera définitivement l'étudiant de la classe.
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={withdrawMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-error-600 hover:bg-error-700 disabled:bg-error-400 text-white font-medium rounded-xl transition-colors duration-200 disabled:cursor-not-allowed"
                >
                  {withdrawMutation.isPending ? 'Retrait...' : 'Retirer'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseDialog}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors duration-200"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}