# CLAUDE.client-roles.md
**Multi-Role Client (Teacher • Student • Guardian/Parent • Staff)**  
_Frontend: React + TypeScript + Vite + Tailwind + shadcn/ui + TanStack Query • i18n (fr default, ar, en)_

This guide wires the **client side** for **Modules 1–8** for **non-admin** users, using the server APIs you already have:
- **M1** Auth/Users/Profiles/Roles
- **M2** Academics (stages/grades/sections/subjects/timetable)
- **M3** Enrollment & Guardianship
- **M4** Teaching Assignments
- **M5** Attendance
- **M6** Audit Log (read-only in UI)
- **M7** Content & Files (notes + local storage)
- **M8** Assessments (MCQ quizzes)

> This file contains **routes**, **RBAC guards**, **core pages**, **API clients**, **hooks**, and **key components** for **Teacher**, **Student**, **Guardian/Parent**, and **Staff** workspaces.  
> No bootstrap or layout code is included; drop these pieces into your app shell.

---

## 0) Conventions & Prereqs

- **Auth**: `/api/me` returns `{ user: { id, roles: string[] }, profile: { id, ... } }` (cookie session).  
- **Locale**: send `Accept-Language` (fr|en|ar). If `ar`, set `dir="rtl"`.
- **RBAC**: Render pages if user has the required role; hide menu items otherwise.
- **No password/self-service**: Only admin can change passwords. Do **not** surface change-password UI.

Utilities used below:

```ts
// src/lib/env.ts
export const API_URL = import.meta.env.VITE_API_URL as string;

// src/lib/i18n.ts
export type Locale = 'fr'|'en'|'ar';
export function getLocale(): Locale { return (localStorage.getItem('locale') as Locale) || 'fr'; }
export function isRTL(loc: Locale) { return loc === 'ar'; }

// src/lib/http.ts
export async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'Accept-Language': getLocale(), ...(init?.headers||{}) },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({ error:{ message: res.statusText }}));
    throw new Error(err?.error?.message || res.statusText);
  }
  return res.json();
}
1) Global Auth & Guards
ts
Copier le code
// src/modules/auth/types.ts
export interface Me {
  user: { id: string; roles: string[] };
  profile: { id: string; code?: string; firstName?: string; lastName?: string };
}

// src/modules/auth/api.ts
import { http } from '@/lib/http';
export const AuthAPI = { me: () => http<Me>('/me') };

// src/modules/auth/hooks.ts
import { useQuery } from '@tanstack/react-query';
export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: AuthAPI.me, staleTime: 60_000 });
}

// src/modules/auth/guards.tsx
import { Navigate } from 'react-router-dom';
export function RequireRoles({ roles, children }:{ roles: string[]; children: React.ReactNode }) {
  // ADMIN should pass all guards for testing
  const { data, isLoading } = useMe();
  if (isLoading) return null;
  const userRoles = data?.user.roles || [];
  const ok = userRoles.includes('ADMIN') || roles.some(r => userRoles.includes(r));
  return ok ? <>{children}</> : <Navigate to="/" replace />;
}
2) Shared API fragments (used across roles)
ts
Copier le code
// src/modules/shared/api.ts
import { http } from '@/lib/http';

/** Content (Module 7) */
export const ContentAPI = {
  listNotes: (params: { limit?: number; cursor?: string|null; locale?: string } = {}) => {
    const qs = new URLSearchParams({
      limit: String(params.limit ?? 20),
      audience: 'any',
      ...(params.cursor ? { cursor: params.cursor } : {}),
      ...(params.locale ? { locale: params.locale } : {})
    });
    return http<{ items: { id: string; title: string; publishedAt?: string|null; pinUntil?: string|null }[]; nextCursor?: string|null }>(`/content/notes?${qs}`);
  },
  getNote: (id: string, locale?: string) => http(`/content/notes/${id}${locale ? `?locale=${locale}`:''}`),
  markRead: (id: string) => http(`/content/notes/${id}/read`, { method: 'POST', body: JSON.stringify({}) }),
};

/** Attendance (Module 5) */
export const AttendanceAPI = {
  sectionForDate: (sectionId: string, dateISO: string) => http(`/attendance/sections/${sectionId}?date=${encodeURIComponent(dateISO)}`),
  markSection: (sectionId: string, payload: { date: string; marks: { studentProfileId: string; status: 'PRESENT'|'ABSENT'|'LATE'|'EXCUSED'|null; note?: string|null }[] }) =>
    http(`/attendance/sections/${sectionId}/mark`, { method: 'POST', body: JSON.stringify(payload) }),
  mySummary: (from: string, to: string) => http(`/attendance/me?from=${from}&to=${to}`), // student
  studentSummary: (profileId: string, from: string, to: string) => http(`/attendance/students/${profileId}?from=${from}&to=${to}`), // guardian/staff
};

/** Academics (Module 2) */
export const AcademicsAPI = {
  myTimetable: (dateISO: string) => http(`/academics/timetable/me?date=${encodeURIComponent(dateISO)}`),
  mySectionsTaught: () => http(`/teaching/assignments/me`), // teacher
  mySections: () => http(`/enrollment/me/sections`),        // student
  sectionRoster: (sectionId: string) => http(`/enrollment/sections/${sectionId}/students`),
};

/** Assessments (Module 8) */
export const AssessAPI = {
  available: () => http(`/assessments/quizzes/available`),
  start: (quizId: string) => http(`/assessments/attempts/start`, { method: 'POST', body: JSON.stringify({ quizId }) }),
  save: (attemptId: string, answers: { questionId: string; selectedOptionIds: string[] }[]) =>
    http(`/assessments/attempts/${attemptId}/answers`, { method: 'POST', body: JSON.stringify({ answers }) }),
  submit: (attemptId: string) => http(`/assessments/attempts/${attemptId}/submit`, { method: 'POST', body: JSON.stringify({}) }),
  attempt: (attemptId: string) => http(`/assessments/attempts/${attemptId}`),
  teacherSubmissions: (quizId: string) => http(`/assessments/teacher/quizzes/${quizId}/submissions`),
};
3) Role Workspaces (Routes & Pages)
3.1 Teacher Workspace (recap)
You already have this from module-teacher-client. Just ensure these routes exist:

/teacher — Today panel + My sections

/teacher/sections/:sectionId — Roster

/teacher/sections/:sectionId/attendance?date=YYYY-MM-DD — Take attendance

/teacher/notes/new?sectionId= — Compose note (Module 7)

/teacher/assess/* — Question bank & quizzes (Module 8 Client)

Guard with: <RequireRoles roles={['TEACHER','STAFF','ADMIN']}>…</RequireRoles>

3.2 Student Portal
Routes

/student — Home (feed + timetable)

/student/notes — Notes/Announcements feed

/student/notes/:id — Note detail (signed attachments)

/student/assess — Available quizzes (Module 8)

/student/assess/attempt/:attemptId — Attempt player

/student/attendance — My attendance summary

Pages & Components

tsx
Copier le code
// src/modules/student/pages/StudentHomePage.tsx
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ContentAPI, AcademicsAPI } from '@/modules/shared/api';
import { getLocale } from '@/lib/i18n';

export default function StudentHomePage(){
  const { data: notes } = useQuery({ queryKey: ['student','notes'], queryFn: () => ContentAPI.listNotes({ limit: 5, locale: getLocale() }) });
  const { data: tt } = useQuery({ queryKey: ['student','timetable', new Date().toDateString()], queryFn: () => AcademicsAPI.myTimetable(new Date().toISOString().slice(0,10)) });
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="border rounded-2xl p-4">
        <h3 className="font-semibold mb-2">Annonces récentes</h3>
        <ul className="space-y-2">
          {(notes?.items || []).map(n => (
            <li key={n.id} className="flex items-center justify-between">
              <Link className="text-blue-600 hover:underline" to={`/student/notes/${n.id}`}>{n.title}</Link>
              <span className="text-xs opacity-70">{n.publishedAt && new Date(n.publishedAt).toLocaleDateString()}</span>
            </li>
          ))}
          {!notes?.items?.length && <li className="text-sm opacity-70">Aucune annonce.</li>}
        </ul>
      </section>
      <section className="border rounded-2xl p-4">
        <h3 className="font-semibold mb-2">Cours aujourd’hui</h3>
        <ul className="space-y-2">
          {(tt?.items || []).map((c:any)=>(
            <li key={`${c.sectionId}-${c.startsAt}`} className="flex items-center justify-between">
              <span>{c.sectionName} — {c.subjectName}</span>
              <span className="text-xs opacity-70">{new Date(c.startsAt).toLocaleTimeString()}–{new Date(c.endsAt).toLocaleTimeString()}</span>
            </li>
          ))}
          {!tt?.items?.length && <li className="text-sm opacity-70">Pas de cours programmés.</li>}
        </ul>
      </section>
    </div>
  );
}
tsx
Copier le code
// src/modules/student/pages/StudentNotesPage.tsx
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ContentAPI } from '@/modules/shared/api';
import { getLocale } from '@/lib/i18n';

export default function StudentNotesPage(){
  const { data, isLoading } = useQuery({ queryKey: ['student','notes','all'], queryFn: () => ContentAPI.listNotes({ limit: 20, locale: getLocale() }) });
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Annonces</h2>
      {isLoading ? <p>Chargement…</p> : (
        <ul className="divide-y rounded-2xl border">
          {(data?.items || []).map(n => (
            <li key={n.id} className="p-3 flex items-center justify-between">
              <Link className="text-blue-600 hover:underline" to={`/student/notes/${n.id}`}>{n.title}</Link>
              <span className="text-xs opacity-70">{n.publishedAt && new Date(n.publishedAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// src/modules/student/pages/StudentNoteDetailPage.tsx
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ContentAPI } from '@/modules/shared/api';
import { getLocale } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

export default function StudentNoteDetailPage(){
  const { id } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ['student','note',id], queryFn: () => ContentAPI.getNote(id!, getLocale()) });
  const mark = useMutation({ mutationFn: () => ContentAPI.markRead(id!) });
  if (isLoading) return <p>Chargement…</p>;
  if (!data) return <p>Introuvable.</p>;
  return (
    <article className="space-y-3">
      <header className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">{data.translation?.title}</h2>
        <span className="text-xs opacity-70 ml-auto">{data.publishedAt && new Date(data.publishedAt).toLocaleString()}</span>
      </header>
      {data.translation?.bodyMd && <pre className="border rounded-xl p-3 whitespace-pre-wrap">{data.translation.bodyMd}</pre>}
      {data.attachments?.length ? (
        <ul className="space-y-2">
          {data.attachments.map((a:any)=>(
            <li key={a.fileId}><a className="text-blue-600 hover:underline" href={a.url} target="_blank" rel="noreferrer">{a.filename} ({Math.round((a.sizeBytes||0)/1024)} KB)</a></li>
          ))}
        </ul>
      ) : null}
      <Button size="sm" onClick={()=>mark.mutate()} disabled={mark.isPending}>Marquer comme lu</Button>
    </article>
  );
}
tsx
Copier le code
// src/modules/student/pages/StudentAssessPage.tsx
import { useMutation, useQuery } from '@tanstack/react-query';
import { AssessAPI } from '@/modules/shared/api';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function StudentAssessPage(){
  const { data, isLoading } = useQuery({ queryKey: ['student','assess','available'], queryFn: AssessAPI.available });
  const start = useMutation({ mutationFn: (quizId: string) => AssessAPI.start(quizId) });
  const nav = useNavigate();

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Évaluations disponibles</h2>
      {isLoading ? <p>Chargement…</p> : (
        <ul className="space-y-2">
          {(data?.items || []).map(q => (
            <li key={q.id} className="border rounded-2xl p-3 flex items-center gap-2">
              <div className="flex-1 text-sm">
                <div className="font-medium">Quiz #{q.id.slice(0,8)}</div>
                <div className="opacity-70">{q.openAt && new Date(q.openAt).toLocaleString()} → {q.closeAt && new Date(q.closeAt).toLocaleString()} · {q.timeLimitSec ? `${Math.round(q.timeLimitSec/60)} min` : '—'}</div>
              </div>
              <Button onClick={()=>start.mutate(q.id, { onSuccess: (r)=> nav(`/student/assess/attempt/${r.attemptId}`, { state: r }) })} disabled={q.attemptsRemaining<=0}>Commencer</Button>
            </li>
          ))}
          {!data?.items?.length && <li className="text-sm opacity-70">Rien pour l’instant.</li>}
        </ul>
      )}
    </div>
  );
}
Use the Attempt Player from Module 8 Client (/student/assess/attempt/:attemptId).

tsx
Copier le code
// src/modules/student/pages/StudentAttendancePage.tsx
import { useQuery } from '@tanstack/react-query';
import { AttendanceAPI } from '@/modules/shared/api';

function range(days=30){
  const end = new Date(); const start = new Date(); start.setDate(end.getDate()-days);
  const fmt = (d:Date)=>d.toISOString().slice(0,10);
  return { from: fmt(start), to: fmt(end) };
}

export default function StudentAttendancePage(){
  const { from, to } = range(30);
  const { data, isLoading } = useQuery({ queryKey: ['student','attendance',from,to], queryFn: () => AttendanceAPI.mySummary(from, to) });
  const rows = (data as any[]) || [];
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Présences (30 jours)</h2>
      {isLoading ? <p>Chargement…</p> : (
        <table className="min-w-full text-sm border rounded-2xl overflow-hidden">
          <thead><tr className="text-left"><th className="p-2">Date</th><th className="p-2">Section</th><th className="p-2">Statut</th></tr></thead>
          <tbody>
            {rows.map((r:any)=>(
              <tr key={r.date+'-'+r.classSectionId} className="border-t">
                <td className="p-2">{r.date}</td>
                <td className="p-2">{r.sectionName}</td>
                <td className="p-2">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
Guard

tsx
Copier le code
// routes
{ path: '/student', element: <RequireRoles roles={['STUDENT','ADMIN','STAFF','TEACHER']}><StudentHomePage/></RequireRoles> },
{ path: '/student/notes', element: <RequireRoles roles={['STUDENT','ADMIN','STAFF','TEACHER']}><StudentNotesPage/></RequireRoles> },
{ path: '/student/notes/:id', element: <RequireRoles roles={['STUDENT','ADMIN','STAFF','TEACHER']}><StudentNoteDetailPage/></RequireRoles> },
{ path: '/student/assess', element: <RequireRoles roles={['STUDENT','ADMIN','STAFF','TEACHER']}><StudentAssessPage/></RequireRoles> },
{ path: '/student/assess/attempt/:attemptId', element: <RequireRoles roles={['STUDENT','ADMIN','STAFF','TEACHER']}><AttemptPlayerPage/></RequireRoles> },
{ path: '/student/attendance', element: <RequireRoles roles={['STUDENT','ADMIN','STAFF','TEACHER']}><StudentAttendancePage/></RequireRoles> },
3.3 Guardian/Parent Portal
Routes

/guardian — Home (children cards)

/guardian/notes — Notes for my children

/guardian/notes/:id — Note detail

/guardian/attendance — Select child → attendance summary

/guardian/assess — Children quiz results (read-only list)

API Assumptions

GET /guardians/me/students → { children: { profileId, firstName, lastName, code }[] }

Attendance & notes visibility leverage existing M3 links and M7/M8 checks.

Pages

tsx
Copier le code
// src/modules/guardian/pages/GuardianHomePage.tsx
import { useQuery } from '@tanstack/react-query';
import { http } from '@/lib/http';

export default function GuardianHomePage(){
  const { data, isLoading } = useQuery({ queryKey: ['guardian','children'], queryFn: () => http<{ children: any[] }>('/guardians/me/students') });
  const kids = data?.children || [];
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Mes enfants</h2>
      {isLoading ? <p>Chargement…</p> : (
        <ul className="grid gap-3 md:grid-cols-3">
          {kids.map(k => (
            <li key={k.profileId} className="border rounded-2xl p-3">
              <div className="font-medium">{k.lastName} {k.firstName}</div>
              <div className="text-xs opacity-70">{k.code}</div>
            </li>
          ))}
          {!kids.length && <li className="text-sm opacity-70">Aucun enfant associé.</li>}
        </ul>
      )}
    </div>
  );
}
tsx
Copier le code
// src/modules/guardian/pages/GuardianAttendancePage.tsx
import { useQuery } from '@tanstack/react-query';
import { AttendanceAPI } from '@/modules/shared/api';
import { useState } from 'react';
import { http } from '@/lib/http';

export default function GuardianAttendancePage(){
  const { data } = useQuery({ queryKey: ['guardian','children'], queryFn: () => http<{ children: any[] }>('/guardians/me/students') });
  const kids = data?.children || [];
  const [kid, setKid] = useState<string | null>(kids[0]?.profileId || null);

  function range(days=30){ const end=new Date(); const start=new Date(); start.setDate(end.getDate()-days); const fmt=(d:Date)=>d.toISOString().slice(0,10); return { from: fmt(start), to: fmt(end)}}
  const { from, to } = range(30);

  const q = useQuery({
    queryKey: ['guardian','attendance',kid,from,to],
    queryFn: () => AttendanceAPI.studentSummary(kid!, from, to),
    enabled: !!kid
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">Présences</h2>
        <select className="ml-auto border rounded px-2 py-1" value={kid||''} onChange={e=>setKid(e.target.value)}>
          {kids.map((k:any)=> <option key={k.profileId} value={k.profileId}>{k.lastName} {k.firstName}</option>)}
        </select>
      </div>
      {q.isLoading ? <p>Chargement…</p> : (
        <table className="min-w-full text-sm border rounded-2xl overflow-hidden">
          <thead><tr className="text-left"><th className="p-2">Date</th><th className="p-2">Classe</th><th className="p-2">Statut</th></tr></thead>
          <tbody>
            {(q.data as any[]||[]).map((r:any)=>(
              <tr key={r.date+'-'+r.classSectionId} className="border-t">
                <td className="p-2">{r.date}</td>
                <td className="p-2">{r.sectionName}</td>
                <td className="p-2">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
For guardian Notes and Assessments, reuse Student note detail and a simple list of submissions, filtered per child if you expose endpoints like /guardians/me/assess/submissions.

Guard

tsx
Copier le code
{ path: '/guardian', element: <RequireRoles roles={['GUARDIAN','ADMIN','STAFF']}><GuardianHomePage/></RequireRoles> },
{ path: '/guardian/attendance', element: <RequireRoles roles={['GUARDIAN','ADMIN','STAFF']}><GuardianAttendancePage/></RequireRoles> },
{ path: '/guardian/notes', element: <RequireRoles roles={['GUARDIAN','ADMIN','STAFF']}><StudentNotesPage/></RequireRoles> },
{ path: '/guardian/notes/:id', element: <RequireRoles roles={['GUARDIAN','ADMIN','STAFF']}><StudentNoteDetailPage/></RequireRoles> },
3.4 Staff Workspace (Registrar/Operations)
Scope

Enrollment ops: manage students in sections, guardians links.

Attendance supervision: edit/override marks.

Content broadcast: post announcements school-wide (optional; share Teacher note form but with wider audience).

Reports: CSV exports (attendance by date range, note reads).

Routes

/staff — Home (quick links)

/staff/enrollment — Find student & assign/unassign sections

/staff/guardians — Link guardian ↔ student

/staff/attendance — Search and edit attendance by section/date

/staff/reports — Download CSVs

API Assumptions

Enrollment:

GET /enrollment/search?query= → students list

GET /enrollment/students/:profileId/sections

POST /enrollment/students/:profileId/sections { add: [sectionId], remove: [sectionId] }

Guardians:

GET /guardians/search?query= → guardians list

POST /guardians/link { guardianProfileId, studentProfileId }

POST /guardians/unlink { guardianProfileId, studentProfileId }

Attendance editing:

GET /attendance/sections/:sectionId?date=YYYY-MM-DD

POST /attendance/sections/:sectionId/mark (same payload as teacher)

Pages (essential stubs)

tsx
Copier le code
// src/modules/staff/pages/StaffHomePage.tsx
import { Link } from 'react-router-dom';
export default function StaffHomePage(){
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Link className="border rounded-2xl p-4 hover:bg-gray-50" to="/staff/enrollment">Inscription / Affectations</Link>
      <Link className="border rounded-2xl p-4 hover:bg-gray-50" to="/staff/guardians">Liens Parents</Link>
      <Link className="border rounded-2xl p-4 hover:bg-gray-50" to="/staff/attendance">Présences (édition)</Link>
      <Link className="border rounded-2xl p-4 hover:bg-gray-50" to="/staff/reports">Rapports</Link>
    </div>
  );
}
tsx
Copier le code
// src/modules/staff/pages/StaffEnrollmentPage.tsx
import { useState } from 'react';
import { http } from '@/lib/http';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function StaffEnrollmentPage(){
  const [q, setQ] = useState('');
  const search = useQuery({ queryKey: ['staff','enroll','search',q], queryFn: () => http(`/enrollment/search?query=${encodeURIComponent(q)}`), enabled: q.length>=2 });
  const [selected, setSelected] = useState<any|null>(null);
  const sec = useQuery({ queryKey: ['staff','enroll','sections', selected?.profileId], queryFn: () => http(`/enrollment/students/${selected?.profileId}/sections`), enabled: !!selected });

  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (body: { add: string[]; remove: string[] }) => http(`/enrollment/students/${selected.profileId}/sections`, { method:'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff','enroll','sections', selected?.profileId] })
  });

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Inscription / Affectations</h2>
      <input className="border rounded px-3 py-2 w-full" placeholder="Rechercher un élève…" value={q} onChange={e=>setQ(e.target.value)} />
      <div className="grid gap-3 md:grid-cols-2">
        <section className="border rounded-2xl p-3">
          <h3 className="font-semibold mb-2">Résultats</h3>
          <ul className="space-y-2">
            {(search.data?.items || []).map((s:any)=>(
              <li key={s.profileId} className="flex items-center justify-between">
                <button className="text-blue-600 hover:underline" onClick={()=>setSelected(s)}>{s.lastName} {s.firstName} — {s.code}</button>
              </li>
            ))}
          </ul>
        </section>
        <section className="border rounded-2xl p-3">
          <h3 className="font-semibold mb-2">Sections de {selected ? `${selected.lastName} ${selected.firstName}` : '—'}</h3>
          {!selected ? <p className="opacity-70 text-sm">Sélectionnez un élève.</p> : (
            <>
              <ul className="space-y-1">
                {(sec.data?.sections || []).map((r:any)=>(
                  <li key={r.id} className="flex items-center justify-between">
                    <span>{r.name}</span>
                    <button className="text-red-600" onClick={()=>save.mutate({ add:[], remove:[r.id] })}>Retirer</button>
                  </li>
                ))}
              </ul>
              <div className="mt-3">
                <input className="border rounded px-2 py-1" placeholder="Ajouter sectionId" onKeyDown={(e:any)=>{ if(e.key==='Enter'){ save.mutate({ add:[e.currentTarget.value], remove:[] }); e.currentTarget.value=''; }}} />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
tsx
Copier le code
// src/modules/staff/pages/StaffAttendanceEditPage.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AttendanceAPI } from '@/modules/shared/api';

export default function StaffAttendanceEditPage(){
  const [sectionId, setSectionId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const q = useQuery({ queryKey: ['staff','att',sectionId,date], queryFn: ()=>AttendanceAPI.sectionForDate(sectionId, date), enabled: !!sectionId && !!date });
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (payload:any)=>AttendanceAPI.markSection(sectionId, payload),
    onSuccess: (_,_vars)=> qc.invalidateQueries({ queryKey: ['staff','att',sectionId,date] })
  });

  const rows = new Map<string,{ studentProfileId: string; status: any; note?: string }>();
  (q.data?.rows||[]).forEach((r:any)=>rows.set(r.studentProfileId, r));

  function setStatus(id:string, s:any){ rows.set(id, { studentProfileId:id, status: s }); }
  function submit(){ save.mutate({ date, marks: Array.from(rows.values()) }); }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Présences — Édition</h2>
      <div className="flex gap-2">
        <input className="border rounded px-2 py-1" placeholder="sectionId" value={sectionId} onChange={e=>setSectionId(e.target.value)} />
        <input className="border rounded px-2 py-1" type="date" value={date} onChange={e=>setDate(e.target.value)} />
        <button className="border rounded px-3" onClick={()=>submit()}>Enregistrer</button>
      </div>
      {q.isLoading ? <p>Chargement…</p> : (
        <table className="min-w-full text-sm border rounded-2xl overflow-hidden">
          <thead><tr><th className="p-2 text-left">Élève</th><th className="p-2">Présent</th><th className="p-2">Absent</th><th className="p-2">Retard</th><th className="p-2">Justifié</th></tr></thead>
          <tbody>
            {(q.data?.rows||[]).map((r:any)=>(
              <tr key={r.studentProfileId} className="border-t">
                <td className="p-2">{r.studentName || r.studentProfileId.slice(0,8)}</td>
                {['PRESENT','ABSENT','LATE','EXCUSED'].map(s=>(
                  <td key={s} className="p-2 text-center">
                    <input type="radio" name={`r-${r.studentProfileId}`} defaultChecked={r.status===s} onChange={()=>setStatus(r.studentProfileId, s)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
Guard

tsx
Copier le code
{ path: '/staff', element: <RequireRoles roles={['STAFF','ADMIN']}><StaffHomePage/></RequireRoles> },
{ path: '/staff/enrollment', element: <RequireRoles roles={['STAFF','ADMIN']}><StaffEnrollmentPage/></RequireRoles> },
{ path: '/staff/guardians', element: <RequireRoles roles={['STAFF','ADMIN']}><div>TODO link/unlink UI</div></RequireRoles> },
{ path: '/staff/attendance', element: <RequireRoles roles={['STAFF','ADMIN']}><StaffAttendanceEditPage/></RequireRoles> },
{ path: '/staff/reports', element: <RequireRoles roles={['STAFF','ADMIN']}><div>TODO CSV exports</div></RequireRoles> },
4) Navigation (role-aware)
Show left menu items based on roles from useMe(); Admin sees everything.

tsx
Copier le code
// src/components/RoleNav.tsx
import { Link } from 'react-router-dom';
import { useMe } from '@/modules/auth/hooks';

export function RoleNav(){
  const { data } = useMe();
  const roles = new Set(data?.user.roles || []);
  return (
    <nav className="space-y-1">
      {roles.has('TEACHER') || roles.has('ADMIN') || roles.has('STAFF') ? (
        <>
          <div className="px-2 text-xs uppercase opacity-60">Enseignant</div>
          <Link className="block px-3 py-2 rounded hover:bg-gray-50" to="/teacher">Espace Enseignant</Link>
        </>
      ):null}
      {roles.has('STUDENT') || roles.has('ADMIN') || roles.has('TEACHER') || roles.has('STAFF') ? (
        <>
          <div className="px-2 text-xs uppercase opacity-60">Élève</div>
          <Link className="block px-3 py-2 rounded hover:bg-gray-50" to="/student">Accueil élève</Link>
        </>
      ):null}
      {roles.has('GUARDIAN') || roles.has('ADMIN') || roles.has('STAFF') ? (
        <>
          <div className="px-2 text-xs uppercase opacity-60">Parent</div>
          <Link className="block px-3 py-2 rounded hover:bg-gray-50" to="/guardian">Espace Parent</Link>
        </>
      ):null}
      {roles.has('STAFF') || roles.has('ADMIN') ? (
        <>
          <div className="px-2 text-xs uppercase opacity-60">Personnel</div>
          <Link className="block px-3 py-2 rounded hover:bg-gray-50" to="/staff">Espace Personnel</Link>
        </>
      ):null}
    </nav>
  );
}
5) i18n Keys (merge into global dictionary)
ts
Copier le code
// src/i18n/roles.ts
export const rolesI18n = {
  fr: {
    common: { loading:'Chargement…', save:'Enregistrer', back:'Retour' },
    teacher: { title:'Espace Enseignant', attendance:'Appel', note:'Publier une note', quiz:'Quiz' },
    student: { title:'Accueil élève', notes:'Annonces', assess:'Évaluations', attendance:'Présences', timetable:'Emploi du temps' },
    guardian: { title:'Espace Parent', children:'Mes enfants', attendance:'Présences' },
    staff: { title:'Espace Personnel', enrollment:'Inscription', guardians:'Liens Parents', attendance:'Présences', reports:'Rapports' },
  },
  en: {
    common: { loading:'Loading…', save:'Save', back:'Back' },
    teacher: { title:'Teacher Workspace', attendance:'Attendance', note:'Post note', quiz:'Quiz' },
    student: { title:'Student Home', notes:'Announcements', assess:'Assessments', attendance:'Attendance', timetable:'Timetable' },
    guardian: { title:'Parent Portal', children:'My children', attendance:'Attendance' },
    staff: { title:'Staff Workspace', enrollment:'Enrollment', guardians:'Guardian Links', attendance:'Attendance', reports:'Reports' },
  },
  ar: {
    common: { loading:'جاري التحميل…', save:'حفظ', back:'رجوع' },
    teacher: { title:'مساحة المعلم', attendance:'الغياب', note:'نشر ملاحظة', quiz:'اختبار' },
    student: { title:'واجهة الطالب', notes:'الإعلانات', assess:'الاختبارات', attendance:'الحضور', timetable:'الجدول' },
    guardian: { title:'واجهة ولي الأمر', children:'أطفالي', attendance:'الحضور' },
    staff: { title:'واجهة الموظفين', enrollment:'التسجيل', guardians:'ربط الأولياء', attendance:'الحضور', reports:'تقارير' },
  },
};
Ensure <html dir={isRTL(locale)?'rtl':'ltr'} lang={locale}>.

6) Accessibility & UX Notes
Use semantic <button>, <label>, <input> and visible focus states.

For Arabic, test table visual order and alignment (use rtl: Tailwind utilities).

Show server errors near action buttons; prefer toast for background failures.

Disable “Change password” for non-admin users (per requirement).

7) Manual End-to-End Tests
Teacher

Open /teacher, see today’s classes.

Take attendance in one section; refresh → persisted.

Publish a note to a class; confirm success.

Student (enrolled in that section)

/student/notes shows the new note; open and download attachment.

/student/assess lists an open quiz; start, answer, submit → score shown.

/student/attendance shows recent marks.

Guardian (linked to the student)

/guardian shows child; /guardian/attendance displays last 30 days.

/guardian/notes shows the note audience to class/grade.

Staff

/staff/enrollment search student → add/remove a section → verify in roster.

/staff/attendance adjust a mark for a date; teacher/student views reflect change.

8) Definition of Done (Client Multi-Role)
 RBAC guards in place; Admin bypasses for QA.

 Teacher workspace operational (attendance, roster, notes, assessments).

 Student portal operational (feed, note detail w/ attachments, timetable, assessments, attendance summary).

 Guardian portal operational (children list, attendance per child, feed).

 Staff workspace operational (enrollment screen, attendance edit; guardians & reports stubs ready).

 All fetches send Accept-Language and render correctly in fr/en/ar; RTL applied for ar.

 No password self-service surfaced for non-admin users.

 Error states and loading states handled; minimal empty states included.

9) Future Enhancements
Offline cache/queue for Teacher attendance (Background sync).

Global search (students/sections/users) with a thin API.

CSV export pages (attendance, submissions) using client-side generation from API datasets.

Rich Markdown rendering (sanitized) for notes and question text.

Notification badges for unread notes and pending quizzes.

“Switch Role” control for multi-role users (teacher+guardian).