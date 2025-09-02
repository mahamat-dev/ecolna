# Module 7 — Client (Content & File Sharing)

**Frontend: React + TypeScript + Vite + Tailwind + shadcn/ui + TanStack Query**
*Targets server Module 7 (local-disk storage only). Supports fr (default), ar, en.*

Publish **notes** (multilingual) with **file attachments**, target specific **audiences** (roles, grade levels, class sections, subjects, individual students/guardians), track **reads**, list/search with **pagination**, and **download** files via private URLs from the backend.

> This file gives complete client-side scaffolding: env, API contracts, hooks, components, pages, i18n strings, routing, role-guards, and test steps. It assumes your app already has Tailwind + shadcn and a global **QueryClientProvider** & **I18nextProvider**.

---

## 0) Prerequisites

* Existing React + TS app (Vite), Tailwind, shadcn/ui installed.
* TanStack Query (React Query) configured with a `QueryClientProvider` at root.
* i18n provider (i18next) already wired (see Module i18n). Default locale **fr**.
* Auth/session already handled (cookies) per previously built modules.

---

## 1) Environment

Create/confirm `client/.env` (or `.env.local`):

```env
VITE_API_URL=http://localhost:4000/api
VITE_MAX_FILE_MB=50
```

Small helper:

```ts
// src/lib/env.ts
export const API_URL = import.meta.env.VITE_API_URL as string;
export const MAX_FILE_MB = Number(import.meta.env.VITE_MAX_FILE_MB ?? 50);
```

---

## 2) Types (mirror server DTOs)

```ts
// src/modules/content/types.ts
export type Locale = 'fr' | 'en' | 'ar';

export interface PresignResponse {
  fileId: string;
  storageKey: string;
  presigned: { url: string; method: 'POST'; headers: Record<string,string> };
}

export interface FileObject {
  id: string; filename: string; mime: string; sizeBytes: number; status: 'PENDING'|'READY'|'DELETED';
}

export interface NoteTranslation { locale: Locale; title: string; bodyMd?: string | null; }

export type AudienceScope = 'ALL'|'ROLE'|'STAGE'|'GRADE_LEVEL'|'CLASS_SECTION'|'SUBJECT'|'STUDENT'|'GUARDIAN';
export type Role = 'ADMIN'|'STAFF'|'TEACHER'|'STUDENT'|'GUARDIAN';

export interface AudienceInput {
  scope: AudienceScope;
  role?: Role;
  stageId?: string;
  gradeLevelId?: string;
  classSectionId?: string;
  subjectId?: string;
  studentProfileId?: string;
  guardianProfileId?: string;
}

export interface CreateNoteInput {
  academicYearId?: string | null;
  termId?: string | null;
  translations: NoteTranslation[];
  attachments: string[]; // fileIds
  audiences: AudienceInput[];
  pinUntil?: string | Date | null;
}

export interface NoteListItem {
  id: string;
  isPublished: boolean;
  publishedAt?: string;
  pinUntil?: string;
  title: string;
  locale: Locale;
}

export interface NoteDetail {
  id: string;
  isPublished: boolean;
  publishedAt?: string;
  pinUntil?: string;
  translation: { locale: Locale; title: string; bodyMd?: string | null } | null;
  attachments: { fileId: string; filename: string; mime: string; sizeBytes: number; url: string }[];
}
```

---

## 3) API Client

```ts
// src/modules/content/api.ts
import { API_URL } from '@/lib/env';
import type { CreateNoteInput, NoteDetail, NoteListItem, PresignResponse } from './types';

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText }}));
    throw new Error(err?.error?.message || res.statusText);
  }
  return res.json();
}

export const ContentAPI = {
  // Files
  presign: (body: { filename: string; mime: string; sizeBytes: number; sha256?: string }): Promise<PresignResponse> =>
    http('/content/files/presign', { method: 'POST', body: JSON.stringify(body) }),
  commit: (body: { fileId: string; sizeBytes: number; sha256?: string }) =>
    http('/content/files/commit', { method: 'POST', body: JSON.stringify(body) }),
  // Notes
  createNote: (body: CreateNoteInput) => http('/content/notes', { method: 'POST', body: JSON.stringify(body) }),
  updateNote: (id: string, body: Partial<CreateNoteInput>) => http(`/content/notes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  publish: (id: string, publish: boolean) => http(`/content/notes/${id}/publish`, { method: 'POST', body: JSON.stringify({ publish }) }),
  listNotes: (params: URLSearchParams) => http<{ items: NoteListItem[]; nextCursor?: string | null }>(`/content/notes?${params.toString()}`),
  getNote: (id: string, locale?: string) => http<NoteDetail>(`/content/notes/${id}${locale ? `?locale=${locale}`: ''}`),
  markRead: (id: string) => http(`/content/notes/${id}/read`, { method: 'POST' }),
};
```

---

## 4) Hooks (TanStack Query)

```ts
// src/modules/content/hooks.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ContentAPI } from './api';
import type { CreateNoteInput, NoteDetail, NoteListItem } from './types';

export function useNotesList(q: { q?: string; limit?: number; cursor?: string | null; locale?: string; mine?: boolean }) {
  const params = new URLSearchParams();
  params.set('limit', String(q.limit ?? 20));
  params.set('audience', 'any');
  if (q.q) params.set('q', q.q);
  if (q.cursor) params.set('cursor', q.cursor);
  if (q.locale) params.set('locale', q.locale);
  if (q.mine) params.set('mine', 'true');
  return useQuery({
    queryKey: ['notes', params.toString()],
    queryFn: () => ContentAPI.listNotes(params),
    staleTime: 30_000,
  });
}

export function useNoteDetail(id: string, locale?: string) {
  return useQuery<NoteDetail>({
    queryKey: ['note', id, locale],
    queryFn: () => ContentAPI.getNote(id, locale),
    enabled: Boolean(id),
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateNoteInput) => ContentAPI.createNote(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notes'] }); },
  });
}

export function useUpdateNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<CreateNoteInput>) => ContentAPI.updateNote(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['note', id] }); qc.invalidateQueries({ queryKey: ['notes'] }); },
  });
}

export function usePublishNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (publish: boolean) => ContentAPI.publish(id, publish),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['note', id] }); qc.invalidateQueries({ queryKey: ['notes'] }); },
  });
}

export function useMarkRead(id: string) {
  return useMutation({ mutationFn: () => ContentAPI.markRead(id) });
}
```

---

## 5) File Upload (Local presign + POST + commit)

### 5.1 WebCrypto (optional) — sha256

```ts
// src/lib/hash.ts
export async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### 5.2 Component: `FileUploader`

* Calls `/content/files/presign` with filename/mime/size (+hash if computed)
* Uploads with **`XMLHttpRequest`** to support progress events
* Commits `/content/files/commit`
* Emits created `fileId`

```tsx
// src/modules/content/components/FileUploader.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ContentAPI } from '../api';
import { MAX_FILE_MB } from '@/lib/env';
import { sha256Hex } from '@/lib/hash';

export function FileUploader({ onUploaded }: { onUploaded: (fileId: string) => void }) {
  const [progress, setProgress] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Max ${MAX_FILE_MB}MB`);
      return;
    }
    setBusy(true);
    try {
      const sha = await sha256Hex(f).catch(() => undefined);
      const presign = await ContentAPI.presign({ filename: f.name, mime: f.type || 'application/octet-stream', sizeBytes: f.size, sha256: sha });

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', presign.presigned.url, true);
        xhr.upload.onprogress = (evt) => { if (evt.lengthComputable) setProgress(Math.round((evt.loaded/evt.total)*100)); };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error(`Upload failed ${xhr.status}`));
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(f);
      });

      await ContentAPI.commit({ fileId: presign.fileId, sizeBytes: f.size, sha256: sha });
      onUploaded(presign.fileId);
      setProgress(100);
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <input type="file" onChange={handleSelect} disabled={busy} />
      {busy && <Progress value={progress} />}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

For **multiple** files, wrap multiple `FileUploader` or adapt to accept multiple and collect IDs.

---

## 6) Form Pieces

### 6.1 Translations editor

```tsx
// src/modules/content/components/TranslationFields.tsx
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Locale, NoteTranslation } from '../types';

const LOCALES: Locale[] = ['fr','en','ar'];

export function TranslationFields({ value, onChange }: { value: NoteTranslation[]; onChange: (v: NoteTranslation[]) => void }) {
  function setItem(loc: Locale, patch: Partial<NoteTranslation>) {
    const next = [...value];
    const idx = next.findIndex(t => t.locale === loc);
    if (idx >= 0) next[idx] = { ...next[idx], ...patch } as NoteTranslation; else next.push({ locale: loc, title: '', bodyMd: '', ...patch } as NoteTranslation);
    onChange(next);
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {LOCALES.map(loc => (
        <div key={loc} className="space-y-2 border p-3 rounded-xl">
          <div className="text-xs uppercase opacity-70">{loc}</div>
          <Input placeholder="Titre" value={value.find(v=>v.locale===loc)?.title || ''} onChange={e=>setItem(loc,{ title: e.target.value })} />
          <Textarea placeholder="Corps (Markdown)" rows={8} value={value.find(v=>v.locale===loc)?.bodyMd || ''} onChange={e=>setItem(loc,{ bodyMd: e.target.value })} />
        </div>
      ))}
    </div>
  );
}
```

### 6.2 Audience selector (MVP)

> Uses IDs. You can enhance by autocompletes calling your academics/enrollment endpoints.

```tsx
// src/modules/content/components/AudienceSelector.tsx
import { useState } from 'react';
import type { AudienceInput, Role } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const ROLES: Role[] = ['ADMIN','STAFF','TEACHER','STUDENT','GUARDIAN'];

export function AudienceSelector({ value, onChange }: { value: AudienceInput[]; onChange: (v: AudienceInput[]) => void }) {
  const [scope, setScope] = useState<AudienceInput['scope']>('ALL');
  const [payload, setPayload] = useState<Partial<AudienceInput>>({});

  function add() {
    const item: AudienceInput = { scope, ...payload } as AudienceInput;
    onChange([...(value||[]), item]);
    setPayload({});
  }

  function remove(i: number) {
    const next = [...value];
    next.splice(i,1); onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <select className="border rounded px-2 py-2" value={scope} onChange={e=>setScope(e.target.value as any)}>
          {['ALL','ROLE','STAGE','GRADE_LEVEL','CLASS_SECTION','SUBJECT','STUDENT','GUARDIAN'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {scope==='ROLE' && (
          <select className="border rounded px-2 py-2" value={payload.role as any || ''} onChange={e=>setPayload(p=>({ ...p, role: e.target.value as Role }))}>
            <option value="">role…</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        {scope==='GRADE_LEVEL' && <Input placeholder="gradeLevelId" value={payload.gradeLevelId||''} onChange={e=>setPayload(p=>({ ...p, gradeLevelId: e.target.value }))} />}
        {scope==='CLASS_SECTION' && <Input placeholder="classSectionId" value={payload.classSectionId||''} onChange={e=>setPayload(p=>({ ...p, classSectionId: e.target.value }))} />}
        {scope==='SUBJECT' && <Input placeholder="subjectId" value={payload.subjectId||''} onChange={e=>setPayload(p=>({ ...p, subjectId: e.target.value }))} />}
        {scope==='STUDENT' && <Input placeholder="studentProfileId" value={payload.studentProfileId||''} onChange={e=>setPayload(p=>({ ...p, studentProfileId: e.target.value }))} />}
        {scope==='GUARDIAN' && <Input placeholder="guardianProfileId" value={payload.guardianProfileId||''} onChange={e=>setPayload(p=>({ ...p, guardianProfileId: e.target.value }))} />}
      </div>
      <Button type="button" onClick={add} className="mt-1">Ajouter</Button>
      <ul className="text-sm space-y-1">
        {value.map((a,i)=>(
          <li key={i} className="flex items-center justify-between border rounded p-2">
            <span>{a.scope}{a.role?`:${a.role}`:''}{a.gradeLevelId?`#${a.gradeLevelId}`:''}{a.classSectionId?`#${a.classSectionId}`:''}{a.subjectId?`#${a.subjectId}`:''}{a.studentProfileId?`#${a.studentProfileId}`:''}{a.guardianProfileId?`#${a.guardianProfileId}`:''}</span>
            <Button type="button" variant="ghost" size="sm" onClick={()=>remove(i)}>✕</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 7) Note Form (Create/Edit)

```tsx
// src/modules/content/components/NoteForm.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TranslationFields } from './TranslationFields';
import { AudienceSelector } from './AudienceSelector';
import { FileUploader } from './FileUploader';
import type { AudienceInput, CreateNoteInput, NoteTranslation } from '../types';

export function NoteForm({ initial, onSubmit, submitting }:{ initial?: Partial<CreateNoteInput>; submitting?: boolean; onSubmit: (val: CreateNoteInput) => void }) {
  const [translations, setTranslations] = useState<NoteTranslation[]>(initial?.translations || [{ locale:'fr', title:'', bodyMd:'' }]);
  const [audiences, setAudiences] = useState<AudienceInput[]>(initial?.audiences || [{ scope:'ALL' } as AudienceInput]);
  const [attachments, setAttachments] = useState<string[]>(initial?.attachments || []);
  const [pinUntil, setPinUntil] = useState<string>(initial?.pinUntil as any || '');

  function addFile(fileId: string){ setAttachments(prev => [...prev, fileId]); }

  function submit(){
    onSubmit({ translations, audiences, attachments, pinUntil: pinUntil || null });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="font-semibold">Traductions</h3>
        <TranslationFields value={translations} onChange={setTranslations} />
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Fichiers</h3>
        <FileUploader onUploaded={addFile} />
        <div className="text-sm opacity-70">Fichiers joints: {attachments.length}</div>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Audience</h3>
        <AudienceSelector value={audiences} onChange={setAudiences} />
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Épinglage</h3>
        <Input type="datetime-local" value={pinUntil} onChange={e=>setPinUntil(e.target.value)} />
      </section>

      <Button onClick={submit} disabled={submitting}>Enregistrer</Button>
    </div>
  );
}
```

---

## 8) Pages & Routing

### 8.1 List Page

```tsx
// src/modules/content/pages/NotesListPage.tsx
import { useState } from 'react';
import { useNotesList } from '../hooks';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function NotesListPage(){
  const [q,setQ] = useState('');
  const [cursor,setCursor] = useState<string | null>(null);
  const { data, isLoading, refetch } = useNotesList({ q, limit: 20, cursor });

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input placeholder="Rechercher" value={q} onChange={e=>setQ(e.target.value)} />
        <Button onClick={()=>{ setCursor(null); refetch(); }}>Rechercher</Button>
        <Link to="/content/notes/new" className="ml-auto"><Button>Nouveau</Button></Link>
      </div>

      {isLoading ? <p>Chargement…</p> : (
        <ul className="space-y-2">
          {items.map(n => (
            <li key={n.id} className="border rounded-xl p-3">
              <Link to={`/content/notes/${n.id}`} className="font-medium hover:underline">{n.title}</Link>
              <div className="text-xs opacity-70">{n.isPublished ? 'Publié' : 'Brouillon'} · {n.publishedAt ? new Date(n.publishedAt).toLocaleString() : ''}</div>
            </li>
          ))}
        </ul>
      )}

      {data?.nextCursor && (
        <Button variant="outline" onClick={()=>setCursor(data.nextCursor!)}>Plus</Button>
      )}
    </div>
  );
}
```

### 8.2 Create Page

```tsx
// src/modules/content/pages/NoteCreatePage.tsx
import { useNavigate } from 'react-router-dom';
import { useCreateNote } from '../hooks';
import { NoteForm } from '../components/NoteForm';

export default function NoteCreatePage(){
  const nav = useNavigate();
  const create = useCreateNote();

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Nouvelle note</h2>
      <NoteForm onSubmit={(val)=>create.mutate(val, { onSuccess: (n:any)=> nav(`/content/notes/${n.id}`) })} submitting={create.isPending} />
    </div>
  );
}
```

### 8.3 Detail Page

```tsx
// src/modules/content/pages/NoteDetailPage.tsx
import { useParams } from 'react-router-dom';
import { useNoteDetail, useMarkRead, usePublishNote } from '../hooks';
import { Button } from '@/components/ui/button';

export default function NoteDetailPage(){
  const { id } = useParams();
  const { data, isLoading } = useNoteDetail(id!);
  const mark = useMarkRead(id!);
  const pub = usePublishNote(id!);

  if (isLoading) return <p>Chargement…</p>;
  if (!data) return <p>Introuvable</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold flex-1">{data.translation?.title || '(sans titre)'}</h2>
        {data.isPublished
          ? <Button variant="outline" onClick={()=>pub.mutate(false)}>Dépublier</Button>
          : <Button onClick={()=>pub.mutate(true)}>Publier</Button>}
        <Button variant="secondary" onClick={()=>mark.mutate()}>Marquer comme lu</Button>
      </div>

      {data.translation?.bodyMd && (
        <article className="prose max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeMarkdown(data.translation.bodyMd) }} />
      )}

      <section className="space-y-2">
        <h3 className="font-semibold">Pièces jointes</h3>
        <ul className="list-disc pl-5">
          {data.attachments.map(att => (
            <li key={att.fileId}><a className="text-blue-600 hover:underline" href={att.url}>{att.filename}</a></li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// Minimal MD sanitizer placeholder — replace with a real sanitizer/renderer
function sanitizeMarkdown(md?: string){
  const esc = (s:string)=>s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]!));
  return `<pre>${esc(md||'')}</pre>`;
}
```

### 8.4 Routing entries

Integrate these into your router (example with `react-router-dom`):

```tsx
// src/app-routes.tsx (excerpt)
import NotesListPage from '@/modules/content/pages/NotesListPage';
import NoteCreatePage from '@/modules/content/pages/NoteCreatePage';
import NoteDetailPage from '@/modules/content/pages/NoteDetailPage';
import { RequireRoles } from '@/modules/content/role-guard';

export const routes = [
  { path: '/content/notes', element: <NotesListPage /> },
  { path: '/content/notes/new', element: <RequireRoles roles={['ADMIN','STAFF','TEACHER']}><NoteCreatePage /></RequireRoles> },
  { path: '/content/notes/:id', element: <NoteDetailPage /> },
];
```

---

## 9) Role guard

```tsx
// src/modules/content/role-guard.tsx
import { Navigate } from 'react-router-dom';

// Replace with your real auth state selector
function useAuth(){
  // example shape
  return { roles: ['ADMIN'] as string[] | undefined, loading: false };
}

export function RequireRoles({ roles, children }:{ roles: string[]; children: React.ReactNode }){
  const { roles: my, loading } = useAuth();
  if (loading) return null;
  if (!my || !roles.some(r => my.includes(r))) return <Navigate to="/" replace />;
  return <>{children}</>;
}
```

---

## 10) i18n strings (module-scoped)

```ts
// src/modules/content/i18n.ts
export const contentI18n = {
  fr: {
    content: {
      title: 'Contenus', search: 'Rechercher', new: 'Nouveau', attachments: 'Pièces jointes',
      publish: 'Publier', unpublish: 'Dépublier', markRead: 'Marquer comme lu', loading: 'Chargement…',
    }
  },
  en: { content: { title: 'Contents', search: 'Search', new: 'New', attachments: 'Attachments', publish: 'Publish', unpublish:'Unpublish', markRead:'Mark as read', loading: 'Loading…' } },
  ar: { content: { title: 'المحتوى', search: 'بحث', new: 'جديد', attachments: 'مرفقات', publish: 'نشر', unpublish:'إلغاء النشر', markRead:'وضع كمقروء', loading: 'جارٍ التحميل…' } },
};
```

> Merge into your global i18n resources and ensure `dir="rtl"` is applied when locale is `ar`.

---

## 11) UX notes

* Show attachment count in list rows.
* Show pin badge if `pinUntil` is in the future.
* Respect locale for dates via `toLocaleString()` with user locale.
* For large bodies, render Markdown with a proper renderer + sanitizer.
* Disable create/publish buttons for non-authorized roles.

---

## 12) Manual tests

1. Login as **ADMIN/STAFF/TEACHER**.
2. Go to **/content/notes/new** → enter FR title & body, add audience `CLASS_SECTION#<id>`, upload a PDF → Save → Publish.
3. As a **Student** in that section, visit **/content/notes** → item visible → open → download attachment → Mark as read.
4. As **Admin**, list page search by keyword; click **Plus** to paginate.

---

## 13) Definition of Done (Client)

* [ ] File upload works end-to-end (presign → POST → commit), progress displayed, errors surfaced.
* [ ] Create/edit note with **translations (fr/en/ar)**, **audiences**, **attachments**, **pinUntil**.
* [ ] List view with search & cursor pagination; shows only visible items (server enforces).
* [ ] Detail view shows best-fit translation and attachment links; can publish/unpublish; can mark read.
* [ ] Role-based guards enforced in routing/UI.
* [ ] i18n strings loaded; RTL respected for ar.
* [ ] No references to S3/minio; purely local upload URLs.

---

## 14)  Enhancements

* Rich Markdown editor (toolbar, preview, paste images → upload).
* Audience autocomplete (fetch class sections, subjects, students) with async Combobox.
* Infinite scroll via `useInfiniteQuery`.
* Client-side caching of attachment metadata.
* Toast notifications + optimistic updates for publish/unpublish.
