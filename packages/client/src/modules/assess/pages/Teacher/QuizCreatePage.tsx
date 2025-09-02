import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useCreateQuiz, useQuestions } from '../../hooks';
import type { CreateQuizDto, QuestionSummary } from '../../types';

export default function QuizCreatePage() {
  const navigate = useNavigate();
  const { data: questions, isLoading: loadingQuestions, isError: errorQuestions } = useQuestions();
  const createQuiz = useCreateQuiz();

  // Basic info (FR-only for now)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimitSec, setTimeLimitSec] = useState<string>('');
  const [maxAttempts, setMaxAttempts] = useState<number>(1);
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(true);
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(true);

  // Selection of questions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pointsById, setPointsById] = useState<Record<string, string>>({});

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const orderedSelected = useMemo(() => selectedIds.map((id, idx) => ({ id, orderIndex: idx })), [selectedIds]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    if (orderedSelected.length === 0) return;

    const payload: CreateQuizDto = {
      subjectId: undefined,
      translations: [
        { locale: 'fr', title: title.trim(), description: description.trim() || undefined },
      ],
      timeLimitSec: timeLimitSec ? Number(timeLimitSec) : null,
      maxAttempts: maxAttempts || 1,
      shuffleQuestions,
      shuffleOptions,
      // openAt/closeAt are not in client CreateQuizDto; server DTO supports, but client API omits for now
      audience: [ { scope: 'ALL' } ],
      questions: orderedSelected.map(({ id, orderIndex }) => ({
        questionId: id,
        orderIndex,
        points: Number(pointsById[id] ?? '1'),
      })),
    };

    const res = await createQuiz.mutateAsync(payload);
    const newId = res?.id;
    if (newId) {
      navigate(`/teacher/assess/quizzes/${newId}/submissions`);
    }
  };

  type QuestionWithTranslations = QuestionSummary & { translations?: Array<{ title?: string; stemMd?: string }> };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create Quiz</h1>
        <p className="text-gray-600">Define quiz details and pick questions from the bank.</p>
      </div>

      <div className="rounded border p-4 space-y-4">
        <h2 className="font-medium">Basic Info (FR)</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">Title</label>
            <input className="w-full border rounded p-2" value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Chapitre 1: Quiz" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">Description (Markdown)</label>
            <textarea className="w-full border rounded p-2" rows={3} value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Instructions du quiz..." />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Time limit (seconds)</label>
            <input type="number" className="w-full border rounded p-2" value={timeLimitSec} onChange={(e)=>setTimeLimitSec(e.target.value)} placeholder="ex: 600" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Max attempts (1-10)</label>
            <input type="number" min={1} max={10} className="w-full border rounded p-2" value={maxAttempts} onChange={(e)=>setMaxAttempts(Number(e.target.value || 1))} />
          </div>
          <div className="flex items-center gap-6 md:col-span-2">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={shuffleQuestions} onChange={(e)=>setShuffleQuestions(e.target.checked)} />
              <span className="text-sm text-gray-700">Shuffle questions</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={shuffleOptions} onChange={(e)=>setShuffleOptions(e.target.checked)} />
              <span className="text-sm text-gray-700">Shuffle options</span>
            </label>
          </div>
          <div className="md:col-span-2">
            <h3 className="font-medium">Audience</h3>
            <div className="text-sm text-gray-700">Scope: ALL (everyone) — more targeting coming soon.</div>
          </div>
        </div>
      </div>

      <div className="rounded border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Pick Questions</h2>
          {loadingQuestions && <span className="text-sm text-gray-500">Loading…</span>}
          {errorQuestions && <span className="text-sm text-red-600">Failed to load questions</span>}
        </div>
        <div className="space-y-2 max-h-80 overflow-auto pr-2">
          {(Array.isArray(questions) ? (questions as QuestionSummary[]) : []).map((q) => {
            const checked = selectedIds.includes(q.id);
            const qx = q as QuestionWithTranslations;
            return (
              <div key={q.id} className="flex items-start justify-between gap-4 py-2 border-b">
                <label className="flex items-start gap-3">
                  <input type="checkbox" checked={checked} onChange={() => toggleSelect(q.id)} />
                  <div>
                    <div className="font-medium">{qx.translations?.[0]?.title || qx.translations?.[0]?.stemMd?.slice(0, 120) || q.id}</div>
                    <div className="text-xs text-gray-500">Type: {q.type}</div>
                  </div>
                </label>
                {checked && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Points</label>
                    <input
                      type="number"
                      min={0}
                      className="w-24 border rounded p-1"
                      value={pointsById[q.id] ?? '1'}
                      onChange={(e)=> setPointsById((p)=> ({ ...p, [q.id]: e.target.value }))}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {(!Array.isArray(questions) || questions.length === 0) && (
            <div className="text-sm text-gray-600">No questions yet. Create some in the Question Bank.</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleCreate} disabled={createQuiz.isPending || !title.trim() || orderedSelected.length === 0}>Create quiz</Button>
        <div className="text-sm text-gray-500">{orderedSelected.length} question(s) selected</div>
      </div>
    </div>
  );
}