# CLAUDE.module-8-client.md
**Module 8 — Client (Assessments: MCQ / Quizzes & Exams)**  
_Frontend: React + TypeScript + Vite + Tailwind + shadcn/ui + TanStack Query • i18n (fr default, ar, en)_

Students: list available quizzes, start attempts, answer MCQs (single/multi/true-false), autosave, countdown, submit, view score.  
Teachers: manage **Question Bank** and **Quizzes** (create/update, audience, schedule, publish), and view **submissions**.

> Assumes server endpoints from Module 8 (already built). No project bootstrap included.  
> Uses your existing global **QueryClientProvider** and **i18n** (with `getCurrentLocale()`).

---

## 0) Routes & Guards

- **Student**
  - `/assess` — Available quizzes list
  - `/assess/attempt/:attemptId` — Attempt player (after start)
- **Teacher**
  - `/teacher/assess` — My quizzes
  - `/teacher/assess/quizzes/new` — Create quiz
  - `/teacher/assess/quizzes/:quizId/edit` — Edit quiz
  - `/teacher/assess/quizzes/:quizId/submissions` — Submissions
  - `/teacher/assess/questions` — Question bank (list/create/edit)

Use your existing `RequireRoles` / `TeacherGuard` components.

---

## 1) Environment helpers

```ts
// src/lib/env.ts (reuse)
export const API_URL = import.meta.env.VITE_API_URL as string;

// src/lib/locale.ts
export function getCurrentLocale(): 'fr'|'en'|'ar' {
  // return from your i18n store; default to 'fr'
  return (window.localStorage.getItem('locale') as any) || 'fr';
}
export function isRTL(loc: string) { return loc === 'ar'; }
2) Types (client-side)
ts
Copier le code
// src/modules/assess/types.ts
export type Locale = 'fr'|'en'|'ar';
export type QuestionType = 'MCQ_SINGLE'|'MCQ_MULTI'|'TRUE_FALSE';

export interface OptionInAttempt {
  id: string;
  text: string;            // localized from server
}

export interface AttemptQuestionPayload {
  questionId: string;
  stemMd: string;          // localized MD
  optionOrder: OptionInAttempt[];
  points: number | string; // number-like
}

export interface StartAttemptResponse {
  attemptId: string;
  quizId: string;
  timeLimitSec?: number | null;
  questions: AttemptQuestionPayload[];
}

export interface AvailableQuizItem {
  id: string;
  openAt?: string | null;
  closeAt?: string | null;
  timeLimitSec?: number | null;
  maxAttempts: number;
  attemptsRemaining: number;
}

export interface SaveAnswersPayload {
  answers: { questionId: string; selectedOptionIds: string[] }[];
}

export interface GradeResult {
  score: number;
  maxScore: number;
}

/** Teacher — Question Bank */
export interface UpsertQuestionInput {
  type: QuestionType;
  subjectId?: string | null;
  translations: { locale: Locale; stemMd: string; explanationMd?: string | null }[];
  options: {
    isCorrect: boolean;
    weight?: number; // 0..1 for MCQ_MULTI
    orderIndex?: number;
    translations: { locale: Locale; text: string }[];
  }[];
}

export interface QuizEditorInput {
  subjectId?: string | null;
  translations: { locale: Locale; title: string; descriptionMd?: string | null }[];
  timeLimitSec?: number | null;
  maxAttempts?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  openAt?: string | Date | null;
  closeAt?: string | Date | null;
  audience: {
    scope: 'ALL'|'GRADE_LEVEL'|'CLASS_SECTION'|'SUBJECT';
    gradeLevelId?: string;
    classSectionId?: string;
    subjectId?: string;
  }[];
  questions: { questionId: string; points?: number; orderIndex?: number }[];
}
3) API client
ts
Copier le code
// src/modules/assess/api.ts
import { API_URL } from '@/lib/env';
import { getCurrentLocale } from '@/lib/locale';
import type {
  AvailableQuizItem, GradeResult, QuizEditorInput, StartAttemptResponse,
  UpsertQuestionInput, SaveAnswersPayload
} from './types';

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': getCurrentLocale(),
      ...(init?.headers || {})
    },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({ error: { message: res.statusText }}));
    throw new Error(err?.error?.message || res.statusText);
  }
  return res.json();
}

export const AssessAPI = {
  // Student
  listAvailable: () => http<{ items: AvailableQuizItem[]; nextCursor?: string|null }>(`/assessments/quizzes/available`),
  startAttempt: (quizId: string) =>
    http<StartAttemptResponse>(`/assessments/attempts/start`, { method: 'POST', body: JSON.stringify({ quizId }) }),
  saveAnswers: (attemptId: string, payload: SaveAnswersPayload) =>
    http(`/assessments/attempts/${attemptId}/answers`, { method: 'POST', body: JSON.stringify(payload) }),
  submitAttempt: (attemptId: string) =>
    http<GradeResult>(`/assessments/attempts/${attemptId}/submit`, { method: 'POST', body: JSON.stringify({}) }),
  getAttempt: (attemptId: string) =>
    http(`/assessments/attempts/${attemptId}`),

  // Teacher — Questions
  createQuestion: (body: UpsertQuestionInput) =>
    http(`/assessments/questions`, { method: 'POST', body: JSON.stringify(body) }),
  updateQuestion: (id: string, body: Partial<UpsertQuestionInput>) =>
    http(`/assessments/questions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  listQuestions: (query?: { subjectId?: string; createdByProfileId?: string }) => {
    const qs = new URLSearchParams();
    if (query?.subjectId) qs.set('subjectId', query.subjectId);
    if (query?.createdByProfileId) qs.set('createdByProfileId', query.createdByProfileId);
    return http(`/assessments/questions?${qs.toString()}`);
  },

  // Teacher — Quizzes
  createQuiz: (body: QuizEditorInput) =>
    http(`/assessments/quizzes`, { method: 'POST', body: JSON.stringify(body) }),
  updateQuiz: (id: string, body: Partial<QuizEditorInput>) =>
    http(`/assessments/quizzes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  publishQuiz: (id: string, publish: boolean) =>
    http(`/assessments/quizzes/${id}/publish`, { method: 'POST', body: JSON.stringify({ publish }) }),
  // Submissions
  listSubmissions: (quizId: string) =>
    http(`/assessments/teacher/quizzes/${quizId}/submissions`),
};
4) Hooks (TanStack Query)
ts
Copier le code
// src/modules/assess/hooks.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AssessAPI } from './api';
import type { QuizEditorInput, UpsertQuestionInput, SaveAnswersPayload } from './types';

export function useAvailableQuizzes() {
  return useQuery({ queryKey: ['assess','available'], queryFn: AssessAPI.listAvailable, staleTime: 30_000 });
}

export function useStartAttempt() {
  return useMutation({ mutationFn: (quizId: string) => AssessAPI.startAttempt(quizId) });
}
export function useSaveAnswers(attemptId: string) {
  return useMutation({ mutationFn: (payload: SaveAnswersPayload) => AssessAPI.saveAnswers(attemptId, payload) });
}
export function useSubmitAttempt(attemptId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => AssessAPI.submitAttempt(attemptId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assess','attempt',attemptId] }); }
  });
}
export function useAttempt(attemptId: string) {
  return useQuery({ queryKey: ['assess','attempt',attemptId], queryFn: () => AssessAPI.getAttempt(attemptId), enabled: !!attemptId });
}

// Teacher
export function useCreateQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpsertQuestionInput) => AssessAPI.createQuestion(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assess','questions'] }); }
  });
}
export function useUpdateQuestion(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<UpsertQuestionInput>) => AssessAPI.updateQuestion(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assess','questions'] }); }
  });
}
export function useQuestions(filter?: { subjectId?: string; createdByProfileId?: string }) {
  return useQuery({ queryKey: ['assess','questions',filter], queryFn: () => AssessAPI.listQuestions(filter) });
}

export function useCreateQuiz() {
  return useMutation({ mutationFn: (body: QuizEditorInput) => AssessAPI.createQuiz(body) });
}
export function useUpdateQuiz(id: string) {
  return useMutation({ mutationFn: (body: Partial<QuizEditorInput>) => AssessAPI.updateQuiz(id, body) });
}
export function usePublishQuiz(id: string) {
  return useMutation({ mutationFn: (publish: boolean) => AssessAPI.publishQuiz(id, publish) });
}
export function useSubmissions(quizId: string) {
  return useQuery({ queryKey: ['assess','submissions',quizId], queryFn: () => AssessAPI.listSubmissions(quizId), enabled: !!quizId });
}
5) Student Components
5.1 Available Quizzes
tsx
Copier le code
// src/modules/assess/components/AvailableList.tsx
import { useAvailableQuizzes, useStartAttempt } from '../hooks';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function AvailableList() {
  const { data, isLoading } = useAvailableQuizzes();
  const start = useStartAttempt();
  const nav = useNavigate();
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Évaluations disponibles</h2>
      {isLoading ? <p>Chargement…</p> : (
        <ul className="space-y-3">
          {items.map(q => (
            <li key={q.id} className="border rounded-2xl p-4 flex items-center gap-3">
              <div className="flex-1">
                <div className="font-medium">Quiz #{q.id.slice(0,8)}</div>
                <div className="text-xs opacity-70">
                  {q.openAt ? new Date(q.openAt).toLocaleString() : '—'} → {q.closeAt ? new Date(q.closeAt).toLocaleString() : '—'}
                  {' · '}Tentatives: {q.maxAttempts} ({q.attemptsRemaining} restantes)
                  {q.timeLimitSec ? ` · ${Math.round((q.timeLimitSec)/60)} min` : ''}
                </div>
              </div>
              <Button
                disabled={start.isPending || q.attemptsRemaining <= 0}
                onClick={() => start.mutate(q.id, {
                  onSuccess: (res) => nav(`/assess/attempt/${res.attemptId}`, { state: res })
                })}
              >
                Commencer
              </Button>
            </li>
          ))}
          {!items.length && <li>Aucun quiz pour le moment.</li>}
        </ul>
      )}
    </div>
  );
}
5.2 Attempt Player (autosave + timer)
tsx
Copier le code
// src/modules/assess/components/AttemptPlayer.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { useSaveAnswers, useSubmitAttempt } from '../hooks';
import type { StartAttemptResponse } from '../types';
import { Button } from '@/components/ui/button';

type SelMap = Record<string, Set<string>>; // questionId -> selected option ids

export default function AttemptPlayer(){
  const { attemptId } = useParams();
  const nav = useNavigate();
  const state = useLocation().state as StartAttemptResponse | undefined;

  // If user refreshed, we need state; in MVP, redirect back if missing
  const [meta] = useState<StartAttemptResponse | null>(state ?? null);
  const [index, setIndex] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const questions = meta?.questions ?? [];
  const q = questions[index];

  // Local selection state
  const [sel, setSel] = useState<SelMap>({});
  const save = useSaveAnswers(attemptId!);
  const submit = useSubmitAttempt(attemptId!);

  // Autosave (debounced)
  const debounceRef = useRef<number>();
  function scheduleSave(){
    if (!meta) return;
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const payload = {
        answers: Object.entries(sel).map(([questionId, set]) => ({
          questionId, selectedOptionIds: Array.from(set)
        }))
      };
      save.mutate(payload as any);
    }, 800);
  }

  // Timer
  const startTimeRef = useRef<number>(Date.now());
  const [remaining, setRemaining] = useState<number | null>(meta?.timeLimitSec ?? null);
  useEffect(() => {
    if (!meta?.timeLimitSec) return;
    const id = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current)/1000);
      const left = Math.max(0, (meta.timeLimitSec ?? 0) - elapsed);
      setRemaining(left);
      if (left <= 0) { handleSubmit(); }
    }, 1000);
    return () => window.clearInterval(id);
  }, [meta?.timeLimitSec]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  if (!meta || !attemptId) {
    return <div className="space-y-2">
      <p className="text-red-600">Session perdue. Retour.</p>
      <Button onClick={()=>nav('/assess', { replace: true })}>Retour</Button>
    </div>;
  }

  function toggle(questionId: string, optionId: string, multi=false) {
    setSel(prev => {
      const next: SelMap = { ...prev };
      const cur = new Set(next[questionId] || []);
      if (multi) {
        if (cur.has(optionId)) cur.delete(optionId); else cur.add(optionId);
        next[questionId] = cur;
      } else {
        next[questionId] = new Set([optionId]);
      }
      return next;
    });
    scheduleSave();
  }

  async function handleSubmit() {
    setSubmitError(null);
    try {
      // final save before submit
      const payload = {
        answers: Object.entries(sel).map(([questionId, set]) => ({
          questionId, selectedOptionIds: Array.from(set)
        }))
      };
      if ((payload.answers?.length ?? 0) > 0) {
        await save.mutateAsync(payload as any).catch(()=>{ /* ignore transient */ });
      }
      const res = await submit.mutateAsync();
      alert(`Score: ${res.score}/${res.maxScore}`);
      nav('/assess', { replace: true });
    } catch (e: any) {
      setSubmitError(e.message || 'Erreur lors de la soumission');
    }
  }

  const pct = meta.timeLimitSec ? Math.round(((remaining ?? meta.timeLimitSec)/(meta.timeLimitSec))*100) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="font-semibold">Question {index+1}/{questions.length}</div>
        {remaining !== null && (
          <div className="ml-auto flex items-center gap-2">
            <div className="text-sm tabular-nums">{Math.floor((remaining)/60)}:{String((remaining)%60).padStart(2,'0')}</div>
            <div aria-hidden className="h-2 w-40 bg-gray-200 rounded">
              <div className="h-2 bg-gray-600 rounded" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* stem (basic) */}
      <article className="prose max-w-none border rounded-xl p-3" dangerouslySetInnerHTML={{ __html: mdToHtml(q.stemMd) }} />

      <ul className="space-y-2">
        {q.optionOrder.map(opt => {
          const selected = sel[q.questionId]?.has(opt.id) ?? false;
          const multi = true; // we don't know single/multi per question from payload; treat multi-friendly
          return (
            <li key={opt.id}>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type={multi ? 'checkbox' : 'radio'}
                  checked={selected}
                  onChange={()=>toggle(q.questionId, opt.id, /*multi*/ true)}
                />
                <span dangerouslySetInnerHTML={{ __html: mdToHtml(opt.text) }} />
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-2">
        <Button variant="outline" disabled={index===0} onClick={()=>setIndex(i => Math.max(0, i-1))}>Précédent</Button>
        <Button variant="outline" disabled={index===questions.length-1} onClick={()=>setIndex(i => Math.min(questions.length-1, i+1))}>Suivant</Button>
        <Button className="ml-auto" onClick={handleSubmit} disabled={submit.isPending}>Soumettre</Button>
      </div>

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      {save.isPending && <p className="text-xs opacity-70">Sauvegarde…</p>}
    </div>
  );
}

// super-simple placeholder (replace with real renderer/sanitizer)
function mdToHtml(md: string){ 
  const esc = (s:string)=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]!));
  return `<pre>${esc(md||'')}</pre>`;
}
Note: Because the start payload doesn’t include the question type, the UI uses checkboxes. If you extend the server to include type per question in the attempt payload, switch input to radio for MCQ_SINGLE and TRUE_FALSE.

6) Teacher Components (Question Bank & Quizzes)
6.1 Question Editor (multilingual options)
tsx
Copier le code
// src/modules/assess/components/QuestionEditor.tsx
import { useState } from 'react';
import type { Locale, UpsertQuestionInput } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const LOCALES: Locale[] = ['fr','en','ar'];

export function QuestionEditor({
  initial,
  onSubmit,
  submitting,
}: {
  initial?: Partial<UpsertQuestionInput>;
  submitting?: boolean;
  onSubmit: (val: UpsertQuestionInput) => void;
}) {
  const [type, setType] = useState<UpsertQuestionInput['type']>(initial?.type || 'MCQ_SINGLE');
  const [translations, setTranslations] = useState<UpsertQuestionInput['translations']>(initial?.translations || [
    { locale:'fr', stemMd:'', explanationMd:'' }
  ]);
  const [options, setOptions] = useState<UpsertQuestionInput['options']>(initial?.options || [
    { isCorrect: true, translations: [{ locale:'fr', text:'' }] },
    { isCorrect: false, translations: [{ locale:'fr', text:'' }] },
  ]);

  function setStem(loc: Locale, patch: Partial<{ stemMd: string; explanationMd?: string|null }>) {
    const next = [...translations];
    const i = next.findIndex(t => t.locale === loc);
    if (i >= 0) next[i] = { ...next[i], ...patch } as any;
    else next.push({ locale: loc, stemMd: patch.stemMd || '', explanationMd: patch.explanationMd || '' });
    setTranslations(next);
  }
  function setOptText(idx: number, loc: Locale, text: string) {
    const next = [...options];
    const arr = next[idx].translations;
    const j = arr.findIndex(t => t.locale === loc);
    if (j >= 0) arr[j] = { locale: loc, text }; else arr.push({ locale: loc, text });
    setOptions(next);
  }
  function addOption() {
    setOptions(o => [...o, { isCorrect: false, translations: [{ locale:'fr', text:'' }] }]);
  }
  function removeOption(i: number) {
    setOptions(o => o.filter((_,idx)=>idx!==i));
  }
  function toggleCorrect(i: number) {
    setOptions(o => o.map((opt, idx) => idx===i
      ? { ...opt, isCorrect: !opt.isCorrect }
      : (type==='MCQ_SINGLE' || type==='TRUE_FALSE') ? { ...opt, isCorrect: false } : opt
    ));
  }

  function submit() {
    onSubmit({
      type,
      translations,
      subjectId: initial?.subjectId ?? null,
      options: options.map((o, i) => ({ ...o, orderIndex: i }))
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-2 md:grid-cols-3">
        <label className="text-sm">Type
          <select className="w-full border rounded px-2 py-2" value={type} onChange={e=>setType(e.target.value as any)}>
            <option value="MCQ_SINGLE">MCQ (une seule)</option>
            <option value="MCQ_MULTI">MCQ (multiples)</option>
            <option value="TRUE_FALSE">Vrai/Faux</option>
          </select>
        </label>
      </div>

      <section className="space-y-2">
        <h4 className="font-semibold">Énoncé</h4>
        <div className="grid gap-4 md:grid-cols-3">
          {LOCALES.map(loc => (
            <div key={loc} className="border rounded-xl p-3 space-y-2">
              <div className="text-xs uppercase opacity-70">{loc}</div>
              <Textarea rows={6} placeholder="Énoncé (Markdown)" value={translations.find(t=>t.locale===loc)?.stemMd || ''} onChange={e=>setStem(loc, { stemMd: e.target.value })} />
              <Textarea rows={4} placeholder="Explication (après soumission)" value={translations.find(t=>t.locale===loc)?.explanationMd || ''} onChange={e=>setStem(loc, { explanationMd: e.target.value })} />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold flex-1">Options</h4>
          <Button variant="outline" onClick={addOption}>Ajouter</Button>
        </div>
        <div className="space-y-3">
          {options.map((opt, i) => (
            <div key={i} className="border rounded-2xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-sm flex items-center gap-2">
                  <input type="checkbox" checked={!!opt.isCorrect} onChange={()=>toggleCorrect(i)} />
                  Correcte
                </label>
                <Button variant="ghost" size="sm" onClick={()=>removeOption(i)}>Supprimer</Button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {LOCALES.map(loc => (
                  <Input key={loc} placeholder={`Texte (${loc})`} value={opt.translations.find(t=>t.locale===loc)?.text || ''} onChange={e=>setOptText(i, loc, e.target.value)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Button onClick={submit} disabled={submitting}>Enregistrer</Button>
    </div>
  );
}
6.2 Quiz Editor (audience, schedule, questions pick)
tsx
Copier le code
// src/modules/assess/components/QuizEditor.tsx
import { useEffect, useState } from 'react';
import type { Locale, QuizEditorInput } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useQuestions } from '../hooks';

const LOCALES: Locale[] = ['fr','en','ar'];

export function QuizEditor({
  initial,
  onSubmit,
  submitting,
}: {
  initial?: Partial<QuizEditorInput>;
  submitting?: boolean;
  onSubmit: (val: QuizEditorInput) => void;
}) {
  const [translations, setTranslations] = useState<QuizEditorInput['translations']>(initial?.translations || [{ locale:'fr', title:'', descriptionMd:'' }]);
  const [openAt, setOpenAt] = useState<string>(initial?.openAt as any || '');
  const [closeAt, setCloseAt] = useState<string>(initial?.closeAt as any || '');
  const [timeLimitSec, setTimeLimitSec] = useState<number | ''>(initial?.timeLimitSec ?? '');
  const [maxAttempts, setMaxAttempts] = useState<number>(initial?.maxAttempts ?? 1);
  const [shuffleQuestions, setSQ] = useState<boolean>(initial?.shuffleQuestions ?? true);
  const [shuffleOptions, setSO] = useState<boolean>(initial?.shuffleOptions ?? true);
  const [audience, setAudience] = useState<QuizEditorInput['audience']>(initial?.audience || [{ scope: 'ALL' } as any]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>(initial?.questions?.map(q=>q.questionId) || []);

  // Pull available questions (you can filter by subject)
  const { data: qdata } = useQuestions();

  function setTr(loc: Locale, patch: Partial<{ title: string; descriptionMd?: string|null }>) {
    const next = [...translations];
    const i = next.findIndex(t => t.locale === loc);
    if (i >= 0) next[i] = { ...next[i], ...patch } as any;
    else next.push({ locale: loc, title: patch.title || '', descriptionMd: patch.descriptionMd || '' });
    setTranslations(next);
  }

  function submit() {
    onSubmit({
      translations,
      timeLimitSec: timeLimitSec === '' ? null : Number(timeLimitSec),
      maxAttempts,
      shuffleQuestions: shuffleQuestions,
      shuffleOptions: shuffleOptions,
      openAt: openAt || null,
      closeAt: closeAt || null,
      audience,
      questions: selectedQuestionIds.map((id, i) => ({ questionId: id, points: 1, orderIndex: i })),
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h4 className="font-semibold">Infos</h4>
        <div className="grid gap-3 md:grid-cols-3">
          {LOCALES.map(loc => (
            <div key={loc} className="border rounded-xl p-3 space-y-2">
              <div className="text-xs uppercase opacity-70">{loc}</div>
              <Input placeholder="Titre" value={translations.find(t=>t.locale===loc)?.title || ''} onChange={e=>setTr(loc,{ title:e.target.value })} />
              <Textarea rows={4} placeholder="Description" value={translations.find(t=>t.locale===loc)?.descriptionMd || ''} onChange={e=>setTr(loc,{ descriptionMd:e.target.value })} />
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <label className="text-sm">Ouverture
          <Input type="datetime-local" value={openAt} onChange={e=>setOpenAt(e.target.value)} />
        </label>
        <label className="text-sm">Fermeture
          <Input type="datetime-local" value={closeAt} onChange={e=>setCloseAt(e.target.value)} />
        </label>
        <label className="text-sm">Durée (sec)
          <Input type="number" value={timeLimitSec} onChange={e=>setTimeLimitSec(e.target.value===''?'':Number(e.target.value))} />
        </label>
        <label className="text-sm">Tentatives max
          <Input type="number" value={maxAttempts} onChange={e=>setMaxAttempts(Number(e.target.value||1))} />
        </label>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={shuffleQuestions} onChange={e=>setSQ(e.target.checked)} />
          Mélanger questions
        </label>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={shuffleOptions} onChange={e=>setSO(e.target.checked)} />
          Mélanger options
        </label>
      </section>

      <section className="space-y-2">
        <h4 className="font-semibold">Audience</h4>
        <div className="flex items-center gap-2">
          <select className="border rounded px-2 py-2" value={audience[0]?.scope} onChange={e=>setAudience([{ scope: e.target.value as any }])}>
            <option value="ALL">Tous</option>
            <option value="GRADE_LEVEL">Niveau</option>
            <option value="CLASS_SECTION">Classe</option>
            <option value="SUBJECT">Matière</option>
          </select>
          {/* Add additional inputs for IDs as needed */}
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="font-semibold">Questions</h4>
        <div className="grid gap-2">
          {(qdata as any[] | undefined)?.map((q: any) => {
            const checked = selectedQuestionIds.includes(q.id);
            return (
              <label key={q.id} className="flex items-center gap-2 border p-2 rounded">
                <input type="checkbox" checked={checked} onChange={(e)=>{
                  setSelectedQuestionIds(prev => e.target.checked ? [...prev, q.id] : prev.filter(x=>x!==q.id));
                }} />
                <span>Q#{q.id.slice(0,8)} · type: {q.type}</span>
              </label>
            );
          })}
        </div>
      </section>

      <Button onClick={submit} disabled={submitting}>Enregistrer</Button>
    </div>
  );
}
6.3 Teacher Pages (list, create, edit, submissions)
tsx
Copier le code
// src/modules/assess/pages/TeacherQuizListPage.tsx
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function TeacherQuizListPage(){
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">Mes Quiz</h2>
        <Link to="/teacher/assess/quizzes/new" className="ml-auto"><Button>Nouveau</Button></Link>
      </div>
      {/* You can add a list if you implement a teacher quizzes endpoint */}
      <p className="text-sm opacity-70">Utilisez la page “Nouveau” pour créer un quiz.</p>
    </div>
  );
}

// src/modules/assess/pages/TeacherQuizCreatePage.tsx
import { useNavigate } from 'react-router-dom';
import { QuizEditor } from '../components/QuizEditor';
import { useCreateQuiz } from '../hooks';

export default function TeacherQuizCreatePage(){
  const nav = useNavigate();
  const create = useCreateQuiz();
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Créer un quiz</h2>
      <QuizEditor submitting={create.isPending} onSubmit={(val)=>create.mutate(val, {
        onSuccess: (q:any) => nav(`/teacher/assess/quizzes/${q.id}/edit`)
      })}/>
    </div>
  );
}

// src/modules/assess/pages/TeacherQuizEditPage.tsx
import { useParams } from 'react-router-dom';
import { QuizEditor } from '../components/QuizEditor';
import { usePublishQuiz, useUpdateQuiz } from '../hooks';
import { Button } from '@/components/ui/button';

export default function TeacherQuizEditPage(){
  const { quizId } = useParams();
  const upd = useUpdateQuiz(quizId!);
  const pub = usePublishQuiz(quizId!);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">Modifier le quiz</h2>
        <Button variant="outline" onClick={()=>pub.mutate(true)} disabled={pub.isPending}>Publier</Button>
        <Button variant="outline" onClick={()=>pub.mutate(false)} disabled={pub.isPending}>Dépublier</Button>
      </div>
      <QuizEditor submitting={upd.isPending} onSubmit={(val)=>upd.mutate(val)} />
    </div>
  );
}

// src/modules/assess/pages/TeacherSubmissionsPage.tsx
import { useParams } from 'react-router-dom';
import { useSubmissions } from '../hooks';

export default function TeacherSubmissionsPage(){
  const { quizId } = useParams();
  const { data, isLoading } = useSubmissions(quizId!);
  const rows = (data as any[]) || [];
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Soumissions</h2>
      {isLoading ? <p>Chargement…</p> : (
        <table className="min-w-full text-sm">
          <thead><tr><th className="p-2 text-left">Élève</th><th className="p-2 text-left">Score</th><th className="p-2 text-left">État</th><th className="p-2 text-left">Date</th></tr></thead>
          <tbody>
            {rows.map((r:any)=>(
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.studentProfileId.slice(0,8)}</td>
                <td className="p-2">{r.score ?? '—'} / {r.maxScore ?? '—'}</td>
                <td className="p-2">{r.status}</td>
                <td className="p-2">{r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
6.4 Question Bank Pages
tsx
Copier le code
// src/modules/assess/pages/TeacherQuestionsPage.tsx
import { useCreateQuestion, useQuestions } from '../hooks';
import { QuestionEditor } from '../components/QuestionEditor';

export default function TeacherQuestionsPage(){
  const { data, isLoading } = useQuestions();
  const create = useCreateQuestion();

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Banque de questions</h2>
      <div className="rounded-2xl border">
        <div className="p-3 border-b font-semibold">Questions existantes</div>
        {isLoading ? <div className="p-3">Chargement…</div> : (
          <ul className="divide-y">
            {(data as any[] || []).map((q:any)=>(
              <li key={q.id} className="p-3 flex items-center justify-between">
                <div>Q#{q.id.slice(0,8)} · {q.type}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Créer une question</h3>
        <QuestionEditor submitting={create.isPending} onSubmit={(val)=>create.mutate(val)} />
      </div>
    </div>
  );
}
7) Student Pages
tsx
Copier le code
// src/modules/assess/pages/StudentAvailablePage.tsx
import { AvailableList } from '../components/AvailableList';
export default function StudentAvailablePage(){ return <AvailableList/>; }

// src/modules/assess/pages/AttemptPlayerPage.tsx
import AttemptPlayer from '../components/AttemptPlayer';
export default function AttemptPlayerPage(){ return <AttemptPlayer/>; }
8) Routing additions
tsx
Copier le code
// src/app-routes.tsx (excerpt)
import StudentAvailablePage from '@/modules/assess/pages/StudentAvailablePage';
import AttemptPlayerPage from '@/modules/assess/pages/AttemptPlayerPage';
import TeacherQuizListPage from '@/modules/assess/pages/TeacherQuizListPage';
import TeacherQuizCreatePage from '@/modules/assess/pages/TeacherQuizCreatePage';
import TeacherQuizEditPage from '@/modules/assess/pages/TeacherQuizEditPage';
import TeacherSubmissionsPage from '@/modules/assess/pages/TeacherSubmissionsPage';
import TeacherQuestionsPage from '@/modules/assess/pages/TeacherQuestionsPage';
import { RequireRoles } from '@/modules/content/role-guard';

export const routes = [
  // Student
  { path: '/assess', element: <RequireRoles roles={['STUDENT','ADMIN','STAFF','TEACHER']}><StudentAvailablePage/></RequireRoles> },
  { path: '/assess/attempt/:attemptId', element: <RequireRoles roles={['STUDENT','ADMIN','STAFF','TEACHER']}><AttemptPlayerPage/></RequireRoles> },

  // Teacher
  { path: '/teacher/assess', element: <RequireRoles roles={['TEACHER','ADMIN','STAFF']}><TeacherQuizListPage/></RequireRoles> },
  { path: '/teacher/assess/questions', element: <RequireRoles roles={['TEACHER','ADMIN','STAFF']}><TeacherQuestionsPage/></RequireRoles> },
  { path: '/teacher/assess/quizzes/new', element: <RequireRoles roles={['TEACHER','ADMIN','STAFF']}><TeacherQuizCreatePage/></RequireRoles> },
  { path: '/teacher/assess/quizzes/:quizId/edit', element: <RequireRoles roles={['TEACHER','ADMIN','STAFF']}><TeacherQuizEditPage/></RequireRoles> },
  { path: '/teacher/assess/quizzes/:quizId/submissions', element: <RequireRoles roles={['TEACHER','ADMIN','STAFF']}><TeacherSubmissionsPage/></RequireRoles> },
];
9) i18n (module strings)
ts
Copier le code
// src/modules/assess/i18n.ts
export const assessI18n = {
  fr: { assess: {
    available: 'Évaluations disponibles',
    start: 'Commencer', submit: 'Soumettre', saving: 'Sauvegarde…',
    questions: 'Questions', audience: 'Audience', open: 'Ouverture', close: 'Fermeture',
    attempts: 'Tentatives', timeLimit: 'Durée', myQuizzes: 'Mes Quiz', new: 'Nouveau',
  }},
  en: { assess: {
    available: 'Available assessments',
    start: 'Start', submit: 'Submit', saving: 'Saving…',
    questions: 'Questions', audience: 'Audience', open: 'Open', close: 'Close',
    attempts: 'Attempts', timeLimit: 'Time limit', myQuizzes: 'My quizzes', new: 'New',
  }},
  ar: { assess: {
    available: 'الاختبارات المتاحة',
    start: 'ابدأ', submit: 'إرسال', saving: 'جاري الحفظ…',
    questions: 'الأسئلة', audience: 'الجمهور', open: 'فتح', close: 'إغلاق',
    attempts: 'محاولات', timeLimit: 'المدة', myQuizzes: 'اختباراتي', new: 'جديد',
  }},
};
Ensure your layout toggles dir="rtl" when locale is ar.

10) Manual Test Plan
Teacher:

Create 1–2 questions (FR translation at minimum) via /teacher/assess/questions.

Create a quiz (open/close window today, audience to a test class) via /teacher/assess/quizzes/new.

Publish it on the edit page.

Student (enrolled in that class):

Open /assess → see the quiz with attempts remaining.

Click Commencer → attempt opens with timer (if set).

Select answers; wait for Sauvegarde… to resolve (autosave).

Click Soumettre → alert shows score; redirected to list.

Teacher: open Submissions page and verify the attempt is graded with score.

11) Definition of Done (Client)
 Student: list available quizzes; start → attempt player → autosave → submit → score shown.

 Timer shown when timeLimitSec exists; auto-submit at zero.

 Teacher: question bank create (multilingual), quiz create/edit, set audience, schedule, publish, see submissions.

 i18n integrated (fr default, ar RTL, en); Accept-Language sent to server.

 No correctness data leaked to the client before submit (player uses server-localized text only).

 Errors surfaced; navigation guarded by roles.

12) Implement these also (Client)
Render Markdown with a proper sanitizer and math support.

Show per-question correctness & explanations after submission (needs server policy).

Resume attempt after page reload (add /attempts/:id/play endpoint that rehydrates).

Keyboard shortcuts; accessibility labels for radios/checkboxes.

Teacher quiz list endpoint + filters by status/date.

Export submissions CSV; per-question analytics.