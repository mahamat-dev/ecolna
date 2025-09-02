import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useAvailableQuizzes, useStartAttempt } from '@/modules/assess/hooks';

export default function AssessListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useAvailableQuizzes();
  const startAttempt = useStartAttempt();

  const onStart = async (quizId: string) => {
    try {
      const res = await startAttempt.mutateAsync(quizId);
      navigate(`/assess/attempt/${res.attemptId}`);
    } catch {
      // Error is surfaced by startAttempt.error; no-op here
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('menu.assessStudent')}</h1>

      {isLoading && <p className="text-gray-600">{t('common.loading') ?? 'Loading...'}</p>}
      {isError && (
        <div className="text-red-600">
          <p>{(error as Error)?.message ?? 'Failed to load available quizzes.'}</p>
          <button onClick={() => refetch()} className="underline">{t('common.retry') ?? 'Retry'}</button>
        </div>
      )}

      {data && data.length === 0 && (
        <p className="text-gray-600">{t('assess.noneAvailable') ?? 'No quizzes available at the moment.'}</p>
      )}

      <div className="grid gap-3">
        {data?.map((q) => (
          <div key={q.id} className="rounded border p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">{q.title ?? t('assess.untitledQuiz') ?? 'Untitled quiz'}</div>
              <div className="text-sm text-gray-600">
                {q.timeLimitSec ? `${Math.ceil((q.timeLimitSec || 0) / 60)} min` : t('assess.noTimeLimit') ?? 'No time limit'}
                {typeof q.attemptsRemaining === 'number' && (
                  <>
                    {' '}
                    • {q.attemptsRemaining} {t('assess.attemptsRemaining') ?? 'attempt(s) remaining'}
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link to={`/assess/attempt/preview`} className="text-gray-600 hover:underline">
                {t('assess.preview') ?? 'Preview'}
              </Link>
              <button
                onClick={() => onStart(q.id)}
                disabled={startAttempt.isPending || (typeof q.attemptsRemaining === 'number' && q.attemptsRemaining <= 0)}
                className="px-3 py-1.5 rounded bg-brand-600 text-white disabled:opacity-50"
              >
                {startAttempt.isPending ? (t('common.starting') ?? 'Starting...') : (t('assess.start') ?? 'Start')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {startAttempt.isError && (
        <div className="text-red-600">{(startAttempt.error as Error)?.message ?? 'Failed to start attempt.'}</div>
      )}
    </div>
  );
}