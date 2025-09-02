import { useParams } from 'react-router-dom';
import { useAttempt, useSubmitAnswers, useFinishAttempt } from '@/modules/assess/hooks';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { AttemptContent } from '@/modules/assess/types';

export default function AttemptPage() {
  const { attemptId } = useParams();
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError, refetch } = useAttempt(attemptId, i18n.language);
  const submitAnswers = useSubmitAnswers();
  const finishAttempt = useFinishAttempt();

  const [answers, setAnswers] = useState<Map<string, Set<string>>>(new Map());
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!data) return;
    const initial = new Map<string, Set<string>>();
    Object.entries((data as AttemptContent).answers ?? {}).forEach(([qid, ids]) => {
      initial.set(qid, new Set(ids as string[]));
    });
    setAnswers(initial);
    hydratedRef.current = true;
  }, [data]);

  const toggle = (qid: string, optId: string, type: AttemptContent['questions'][number]['type']) => {
    setAnswers(prev => {
      const next = new Map(prev);
      const set = new Set(next.get(qid) ?? []);
      if (type === 'MCQ_SINGLE' || type === 'TRUE_FALSE') {
        const has = set.has(optId);
        set.clear();
        if (!has) set.add(optId);
      } else {
        if (set.has(optId)) set.delete(optId); else set.add(optId);
      }
      next.set(qid, set);
      return next;
    });
  };

  const onSave = useCallback(async () => {
    if (!data || !attemptId) return;
    setSaving(true);
    try {
      const payload = Array.from(answers.entries()).map(([questionId, set]) => ({ questionId, selectedOptionIds: Array.from(set) }));
      if (!payload.length) return;
      await submitAnswers.mutateAsync({ attemptId, answers: payload });
    } finally {
      setSaving(false);
    }
  }, [answers, data, attemptId, submitAnswers]);

  // Debounced autosave after user changes selection
  useEffect(() => {
    if (!attemptId || !hydratedRef.current) return;
    const handle = setTimeout(() => {
      void onSave();
    }, 1200);
    return () => clearTimeout(handle);
  }, [answers, attemptId, onSave]);

  const onFinish = async () => {
    if (!attemptId) return;
    setFinishing(true);
    try {
      await onSave();
      const res = await finishAttempt.mutateAsync(attemptId);
      alert(`${t('assess.preview')}: ${JSON.stringify(res)}`);
    } finally {
      setFinishing(false);
    }
  };

  if (isLoading) return <div>{t('common.loading')}</div>;
  if (isError) return (
    <div className="space-y-3">
      <div className="text-red-600">{t('common.error')}</div>
      <button className="rounded border px-3 py-1" onClick={() => refetch()}>{t('common.retry')}</button>
    </div>
  );

  const attempt = data as AttemptContent;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Attempt</h1>

      {attempt?.timeLimitSec ? (
        <div className="text-sm text-gray-600">{Math.ceil((attempt.timeLimitSec ?? 0) / 60)} min</div>
      ) : (
        <div className="text-sm text-gray-600">{t('assess.noTimeLimit')}</div>
      )}

      <div className="space-y-6">
        {attempt?.questions?.map((q, idx: number) => (
          <div key={q.questionId} className="rounded border p-4 space-y-3">
            <div className="font-medium">{idx + 1}. {q.prompt}</div>
            <div className="space-y-2">
              {q.options.map((opt: { id: string; text: string }) => {
                const sel = answers.get(q.questionId)?.has(opt.id) ?? false;
                const type = q.type;
                const inputType = (type === 'MCQ_SINGLE' || type === 'TRUE_FALSE') ? 'radio' : 'checkbox';
                return (
                  <label key={opt.id} className="flex items-center gap-2">
                    <input
                      type={inputType}
                      name={`q-${q.questionId}`}
                      checked={sel}
                      onChange={() => toggle(q.questionId, opt.id, type)}
                    />
                    <span>{opt.text}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button disabled={saving} className="rounded bg-blue-600 text-white px-4 py-2 disabled:opacity-50" onClick={onSave}>
          {saving ? t('common.loading') : (t('common.save') as string) ?? 'Save'}
        </button>
        <button disabled={finishing} className="rounded bg-green-600 text-white px-4 py-2 disabled:opacity-50" onClick={onFinish}>
          {finishing ? t('common.loading') : (t('common.submit') as string) ?? 'Submit'}
        </button>
      </div>
    </div>
  );
}