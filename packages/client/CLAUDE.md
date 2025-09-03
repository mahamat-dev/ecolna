# CLAUDE.module-11-discipline.client.md
**Module 11 — Discipline (Client)**  
_Client: React + TypeScript + TailwindCSS + shadcn/ui + TanStack Query/Table • i18n (fr default, ar, en) • Auth/RBAC from existing app • File uploads via Module 7_

This file adds a full **Discipline** UI for Admin/Staff/Teacher (manage incidents, actions, detentions) and Student/Guardian (read-only records). It wires against the **server endpoints from Module 11 (Discipline - Server)** and **Module 7 (Content & Files)**.

---

## 0) Assumptions

- You already have:
  - `http` helper (wraps `fetch`, handles JSON, cookies, errors).
  - `useAuth()` returning `{ me, hasRole(role), is(role), profileId }`.
  - `i18n` hook `t()` with locales **fr** (default), **ar**, **en**.
  - Global styles/components from shadcn/ui.
- Routes are mounted under `/discipline/*` in the client.
- For picking students/teachers, you can:
  - Paste `profileId` directly (works now), **and/or**
  - Use your existing people pickers (e.g., Module 3 Enrollment selectors) if available.

> If you don’t yet have a people picker, start with **ID/Code inputs** (no placeholder data) and improve later.

---

## 1) Module Structure (client)

src/
modules/
discipline/
api.ts
hooks.ts
components/
IncidentForm.tsx
ParticipantRow.tsx
ActionAssignDialog.tsx
PublishVisibility.tsx
DetentionForm.tsx
DetentionEnrollDrawer.tsx
AttendanceToggle.tsx
AttachmentsList.tsx
FileUploaderM7.tsx
IncidentsTable.tsx
pages/
IncidentsListPage.tsx
IncidentCreatePage.tsx
IncidentDetailPage.tsx
DetentionSessionsPage.tsx
MyDisciplinePage.tsx
GuardianChildRecordPage.tsx
i18n.ts
router/
routes.discipline.tsx

pgsql
Copier le code

Register the routes in your app router and add a **Discipline** nav item for roles: **ADMIN, STAFF, TEACHER**. Students/Guardians see only their record pages.

---

## 2) API Client

```ts
// src/modules/discipline/api.ts
import { http } from "@/lib/http";

export type UUID = string;

export const DisciplineAPI = {
  // --- Categories ---
  listCategories: () => http(`/discipline/categories`),
  createCategory: (body: {
    code: string; defaultPoints?: number;
    translations: { locale: "fr"|"en"|"ar"; name: string; description?: string }[];
  }) => http(`/discipline/categories`, { method: "POST", body: JSON.stringify(body) }),

  // --- Incidents ---
  listIncidents: (params: { status?: string; studentProfileId?: UUID; myReported?: "true"|"false"; limit?: number; cursor?: string }) =>
    http(`/discipline/incidents?${new URLSearchParams(params as any).toString()}`),
  getIncident: (id: UUID) => http(`/discipline/incidents/${id}`),
  createIncident: (body: {
    categoryId?: UUID|null; summary: string; details?: string; occurredAt: string;
    location?: string; classSectionId?: UUID;
    participants: { profileId: UUID; role: "PERPETRATOR"|"VICTIM"|"WITNESS"; note?: string }[];
    attachments?: UUID[];
  }) => http(`/discipline/incidents`, { method: "POST", body: JSON.stringify(body) }),
  updateIncident: (id: UUID, body: any) => http(`/discipline/incidents/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  publishIncident: (id: UUID, visibility: "PRIVATE"|"STUDENT"|"GUARDIAN") =>
    http(`/discipline/incidents/${id}/publish`, { method: "POST", body: JSON.stringify({ visibility }) }),
  deleteIncident: (id: UUID) => http(`/discipline/incidents/${id}`, { method: "DELETE" }),

  // --- Actions ---
  addAction: (incidentId: UUID, body: {
    profileId: UUID; type: "WARNING"|"DETENTION"|"SUSPENSION_IN_SCHOOL"|"SUSPENSION_OUT_OF_SCHOOL"|"PARENT_MEETING"|"COMMUNITY_SERVICE";
    points?: number; dueAt?: string; comment?: string;
  }) => http(`/discipline/incidents/${incidentId}/actions`, { method: "POST", body: JSON.stringify(body) }),
  completeAction: (actionId: UUID, completed: boolean, comment?: string) =>
    http(`/discipline/actions/${actionId}/complete`, { method: "POST", body: JSON.stringify({ completed, comment }) }),

  // --- Detention ---
  listDetentions: () => http(`/discipline/detention-sessions`),
  createDetention: (body: { title: string; dateTime: string; durationMinutes: number; room?: string; capacity: number }) =>
    http(`/discipline/detention-sessions`, { method: "POST", body: JSON.stringify(body) }),
  enrollDetention: (sessionId: UUID, body: { sessionId: UUID; actionId: UUID; studentProfileId: UUID }) =>
    http(`/discipline/detention-sessions/${sessionId}/enroll`, { method: "POST", body: JSON.stringify(body) }),
  markDetentionAttendance: (sessionId: UUID, studentProfileId: UUID, present: boolean) =>
    http(`/discipline/detention-sessions/${sessionId}/attendance/${studentProfileId}`, { method: "POST", body: JSON.stringify({ present }) }),

  // --- Student/Guardian views ---
  myRecord: () => http(`/discipline/my-record`),
  guardianChildRecord: (studentProfileId: UUID) => http(`/discipline/students/${studentProfileId}/record`),

  // --- Module 7 Files (helper flow) ---
  presign: (filename: string, mime: string, sizeBytes: number, sha256?: string) =>
    http(`/content/files/presign`, { method: "POST", body: JSON.stringify({ filename, mime, sizeBytes, sha256 }) }),
  commit: (fileId: UUID, sizeBytes: number, sha256?: string) =>
    http(`/content/files/commit`, { method: "POST", body: JSON.stringify({ fileId, sizeBytes, sha256 }) }),
};
3) Hooks (TanStack Query)
ts
Copier le code
// src/modules/discipline/hooks.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DisciplineAPI } from "./api";

export function useIncidentsList(params: any) {
  return useQuery({ queryKey: ["disc","list", params], queryFn: () => DisciplineAPI.listIncidents(params) });
}
export function useIncident(id: string) {
  return useQuery({ queryKey: ["disc","one", id], queryFn: () => DisciplineAPI.getIncident(id), enabled: !!id });
}
export function useDetentions() {
  return useQuery({ queryKey: ["disc","detentions"], queryFn: () => DisciplineAPI.listDetentions() });
}
export function useMyRecord() {
  return useQuery({ queryKey: ["disc","my"], queryFn: () => DisciplineAPI.myRecord() });
}
export function useGuardianChildRecord(studentProfileId: string) {
  return useQuery({ queryKey: ["disc","guardian", studentProfileId], queryFn: () => DisciplineAPI.guardianChildRecord(studentProfileId), enabled: !!studentProfileId });
}

export function useCreateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: DisciplineAPI.createIncident,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["disc","list"] }),
  });
}
export function useUpdateIncident(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body:any) => DisciplineAPI.updateIncident(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["disc","one", id] });
      qc.invalidateQueries({ queryKey: ["disc","list"] });
    },
  });
}
export function useAddAction(incidentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body:any) => DisciplineAPI.addAction(incidentId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["disc","one", incidentId] }),
  });
}
export function usePublishIncident(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (visibility:"PRIVATE"|"STUDENT"|"GUARDIAN") => DisciplineAPI.publishIncident(id, visibility),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["disc","one", id] }),
  });
}
4) Components
4.1 Module 7 File Uploader (attachments)
tsx
Copier le code
// src/modules/discipline/components/FileUploaderM7.tsx
import { useState } from "react";
import { DisciplineAPI } from "../api";

export function FileUploaderM7({ onUploaded }: { onUploaded: (fileId: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true);
    try {
      const pres = await DisciplineAPI.presign(file.name, file.type || "application/octet-stream", file.size);
      // local mode: pres.presigned.url is /api/content/local-upload/<key>
      await fetch(pres.presigned.url, { method: pres.presigned.method, headers: pres.presigned.headers, body: file });
      const committed = await DisciplineAPI.commit(pres.fileId, file.size);
      onUploaded(committed.id || pres.fileId);
    } finally { setBusy(false); e.target.value = ""; }
  }
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <input type="file" className="hidden" onChange={onPick} disabled={busy} />
      <span className="border px-3 py-1 rounded">{busy ? "Téléversement..." : "Ajouter une pièce jointe"}</span>
    </label>
  );
}
4.2 Participants row (ID-based to start)
tsx
Copier le code
// src/modules/discipline/components/ParticipantRow.tsx
export type Role = "PERPETRATOR"|"VICTIM"|"WITNESS";

export function ParticipantRow({ idx, value, onChange, onDelete }:{
  idx:number;
  value:{ profileId:string; role:Role; note?:string };
  onChange:(v:any)=>void; onDelete:()=>void;
}){
  return (
    <div className="flex gap-2 items-center">
      <input className="border rounded px-2 py-1 w-[22ch]" placeholder="profileId"
             value={value.profileId} onChange={e=>onChange({ ...value, profileId: e.target.value })} />
      <select className="border rounded px-2 py-1" value={value.role} onChange={e=>onChange({ ...value, role: e.target.value as Role })}>
        <option value="PERPETRATOR">Auteur</option>
        <option value="VICTIM">Victime</option>
        <option value="WITNESS">Témoin</option>
      </select>
      <input className="border rounded px-2 py-1 flex-1" placeholder="note" value={value.note||""} onChange={e=>onChange({ ...value, note: e.target.value })}/>
      <button type="button" className="text-red-600" onClick={onDelete}>Supprimer</button>
    </div>
  );
}
4.3 Incident Create/Edit Form
tsx
Copier le code
// src/modules/discipline/components/IncidentForm.tsx
import { useState } from "react";
import { ParticipantRow } from "./ParticipantRow";
import { FileUploaderM7 } from "./FileUploaderM7";

export function IncidentForm({ onSubmit, loading }:{
  onSubmit:(payload:any)=>void; loading?:boolean;
}){
  const [summary, setSummary] = useState("");
  const [occurredAt, setOccurredAt] = useState(()=> new Date().toISOString().slice(0,16));
  const [details, setDetails] = useState("");
  const [location, setLocation] = useState("");
  const [participants, setParticipants] = useState([{ profileId:"", role:"PERPETRATOR" as const }]);
  const [attachments, setAttachments] = useState<string[]>([]);

  return (
    <form className="space-y-3" onSubmit={(e)=>{ e.preventDefault(); onSubmit({
      summary, details, occurredAt: new Date(occurredAt).toISOString(), location,
      participants, attachments
    }) }}>
      <div>
        <label className="text-sm">Résumé</label>
        <input className="border rounded w-full px-3 py-2" required value={summary} onChange={e=>setSummary(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-sm">Date/Heure</label>
          <input type="datetime-local" className="border rounded w-full px-3 py-2" value={occurredAt} onChange={e=>setOccurredAt(e.target.value)} />
        </div>
        <div>
          <label className="text-sm">Lieu</label>
          <input className="border rounded w-full px-3 py-2" value={location} onChange={e=>setLocation(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-sm">Détails</label>
        <textarea className="border rounded w-full px-3 py-2 min-h-[120px]" value={details} onChange={e=>setDetails(e.target.value)} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Participants</label>
          <button type="button" className="text-blue-600" onClick={()=>setParticipants(p=>[...p, { profileId:"", role:"WITNESS" }])}>Ajouter</button>
        </div>
        {participants.map((p,idx)=>(
          <ParticipantRow key={idx} idx={idx} value={p}
            onChange={(v)=>setParticipants(arr => arr.map((x,i)=> i===idx ? v : x))}
            onDelete={()=>setParticipants(arr => arr.filter((_,i)=>i!==idx))}
          />
        ))}
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Pièces jointes</label>
        <FileUploaderM7 onUploaded={(fid)=>setAttachments(a=>[...a, fid])} />
        <ul className="text-xs opacity-70">{attachments.map(a=><li key={a}>{a}</li>)}</ul>
      </div>
      <div className="pt-2">
        <button type="submit" disabled={loading} className="border rounded px-4 py-2">{loading ? "Envoi..." : "Créer l’incident"}</button>
      </div>
    </form>
  );
}
4.4 Publish Visibility
tsx
Copier le code
// src/modules/discipline/components/PublishVisibility.tsx
export function PublishVisibility({ value, onChange }:{
  value:"PRIVATE"|"STUDENT"|"GUARDIAN"; onChange:(v:any)=>void;
}){
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">Visibilité:</span>
      <select className="border rounded px-2 py-1" value={value} onChange={e=>onChange(e.target.value)}>
        <option value="PRIVATE">Privé</option>
        <option value="STUDENT">Étudiant</option>
        <option value="GUARDIAN">Parent</option>
      </select>
    </div>
  );
}
4.5 Action Assign Dialog
tsx
Copier le code
// src/modules/discipline/components/ActionAssignDialog.tsx
import { useState } from "react";

export function ActionAssignDialog({ open, onClose, onSubmit }:{
  open:boolean; onClose:()=>void; onSubmit:(payload:any)=>void;
}){
  const [profileId, setProfileId] = useState("");
  const [type, setType] = useState("WARNING");
  const [points, setPoints] = useState(0);
  const [dueAt, setDueAt] = useState<string>("");

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/30 grid place-items-center">
      <div className="bg-white rounded-2xl p-4 w-full max-w-md space-y-3">
        <h3 className="text-lg font-semibold">Assigner une action</h3>
        <input className="border rounded w-full px-3 py-2" placeholder="student profileId" value={profileId} onChange={e=>setProfileId(e.target.value)} />
        <div className="flex gap-2">
          <select className="border rounded px-2 py-1" value={type} onChange={e=>setType(e.target.value)}>
            <option value="WARNING">Avertissement</option>
            <option value="DETENTION">Retenue</option>
            <option value="SUSPENSION_IN_SCHOOL">Exclusion interne</option>
            <option value="SUSPENSION_OUT_OF_SCHOOL">Exclusion externe</option>
            <option value="PARENT_MEETING">Entretien parent</option>
            <option value="COMMUNITY_SERVICE">Service</option>
          </select>
          <input type="number" className="border rounded px-2 py-1 w-[10ch]" value={points} onChange={e=>setPoints(parseInt(e.target.value||"0"))} />
          <input type="datetime-local" className="border rounded px-2 py-1" value={dueAt} onChange={e=>setDueAt(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1 border rounded" onClick={onClose}>Annuler</button>
          <button className="px-3 py-1 border rounded bg-slate-50" onClick={()=>{ onSubmit({ profileId, type, points, dueAt: dueAt ? new Date(dueAt).toISOString() : undefined }); onClose(); }}>Assigner</button>
        </div>
      </div>
    </div>
  );
}
4.6 Detention Forms
tsx
Copier le code
// src/modules/discipline/components/DetentionForm.tsx
import { useState } from "react";

export function DetentionForm({ onSubmit }:{ onSubmit:(payload:any)=>void }){
  const [title, setTitle] = useState("");
  const [dateTime, setDateTime] = useState(()=> new Date().toISOString().slice(0,16));
  const [durationMinutes, setDur] = useState(60);
  const [room, setRoom] = useState("");
  const [capacity, setCap] = useState(20);
  return (
    <form className="grid md:grid-cols-5 gap-2 items-end" onSubmit={(e)=>{ e.preventDefault(); onSubmit({
      title, dateTime: new Date(dateTime).toISOString(), durationMinutes, room: room||undefined, capacity
    })}}>
      <input className="border rounded px-2 py-1 md:col-span-2" placeholder="Titre" value={title} onChange={e=>setTitle(e.target.value)} />
      <input type="datetime-local" className="border rounded px-2 py-1" value={dateTime} onChange={e=>setDateTime(e.target.value)} />
      <input type="number" className="border rounded px-2 py-1 w-[12ch]" value={durationMinutes} onChange={e=>setDur(parseInt(e.target.value||"60"))} />
      <div className="flex gap-2">
        <input className="border rounded px-2 py-1 w-[12ch]" placeholder="Salle" value={room} onChange={e=>setRoom(e.target.value)} />
        <input type="number" className="border rounded px-2 py-1 w-[10ch]" value={capacity} onChange={e=>setCap(parseInt(e.target.value||"20"))} />
      </div>
      <button className="border rounded px-3 py-1">Créer</button>
    </form>
  );
}
tsx
Copier le code
// src/modules/discipline/components/DetentionEnrollDrawer.tsx
import { useState } from "react";

export function DetentionEnrollDrawer({ open, onClose, onSubmit }:{
  open:boolean; onClose:()=>void; onSubmit:(payload:{ actionId:string; studentProfileId:string })=>void;
}){
  const [actionId, setActionId] = useState("");
  const [studentProfileId, setStudentProfileId] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/20 flex justify-end">
      <div className="bg-white w-full max-w-md h-full p-4 space-y-3">
        <h3 className="text-lg font-semibold">Inscrire à la retenue</h3>
        <input className="border rounded px-2 py-1 w-full" placeholder="actionId (DETENTION)" value={actionId} onChange={e=>setActionId(e.target.value)} />
        <input className="border rounded px-2 py-1 w-full" placeholder="student profileId" value={studentProfileId} onChange={e=>setStudentProfileId(e.target.value)} />
        <div className="flex gap-2">
          <button className="border rounded px-3 py-1" onClick={onClose}>Fermer</button>
          <button className="border rounded px-3 py-1 bg-slate-50" onClick={()=>{ onSubmit({ actionId, studentProfileId }); onClose(); }}>Inscrire</button>
        </div>
      </div>
    </div>
  );
}
4.7 Incidents Table (TanStack Table)
tsx
Copier le code
// src/modules/discipline/components/IncidentsTable.tsx
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";

export function IncidentsTable({ data }:{ data:any[] }){
  const columns: ColumnDef<any>[] = [
    { header: "Date", accessorKey: "occurredAt", cell: info => new Date(info.getValue<string>()).toLocaleString() },
    { header: "Statut", accessorKey: "status" },
    { header: "Résumé", accessorKey: "summary" },
    { header: "Visibilité", accessorKey: "visibility" },
  ];
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  return (
    <table className="min-w-full text-sm border rounded-2xl overflow-hidden">
      <thead className="bg-slate-50">
        {table.getHeaderGroups().map(hg=>(
          <tr key={hg.id}>
            {hg.headers.map(h=>(
              <th key={h.id} className="p-2 text-left">{flexRender(h.column.columnDef.header, h.getContext())}</th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map(r=>(
          <tr key={r.id} className="border-t">
            {r.getVisibleCells().map(c=>(
              <td key={c.id} className="p-2">{flexRender(c.column.columnDef.cell, c.getContext())}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
5) Pages
5.1 Incidents List (Admin/Staff/Teacher)
tsx
Copier le code
// src/modules/discipline/pages/IncidentsListPage.tsx
import { useState } from "react";
import { useIncidentsList } from "../hooks";
import { IncidentsTable } from "../components/IncidentsTable";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export default function IncidentsListPage(){
  const { hasRole } = useAuth();
  const [status, setStatus] = useState<string>("");
  const q = useIncidentsList({ status: status || undefined, limit: 50 });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">Incidents disciplinaires</h2>
        {hasRole("ADMIN")||hasRole("STAFF")||hasRole("TEACHER") ? (
          <Link to="/discipline/incidents/new" className="ml-auto border rounded px-3 py-1">Nouvel incident</Link>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <select className="border rounded px-2 py-1" value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="">Tous</option>
          <option value="OPEN">Ouverts</option>
          <option value="UNDER_REVIEW">En examen</option>
          <option value="RESOLVED">Résolus</option>
          <option value="CANCELLED">Annulés</option>
        </select>
      </div>
      <IncidentsTable data={q.data?.items || []} />
    </div>
  );
}
5.2 Create Incident
tsx
Copier le code
// src/modules/discipline/pages/IncidentCreatePage.tsx
import { useNavigate } from "react-router-dom";
import { IncidentForm } from "../components/IncidentForm";
import { useCreateIncident } from "../hooks";

export default function IncidentCreatePage(){
  const nav = useNavigate();
  const m = useCreateIncident();
  return (
    <div className="space-y-3 max-w-3xl">
      <h2 className="text-xl font-semibold">Créer un incident</h2>
      <IncidentForm loading={m.isPending} onSubmit={async (payload)=>{
        const row = await m.mutateAsync(payload);
        nav(`/discipline/incidents/${row.id}`);
      }} />
    </div>
  );
}
5.3 Incident Detail (with actions, visibility)
tsx
Copier le code
// src/modules/discipline/pages/IncidentDetailPage.tsx
import { useParams } from "react-router-dom";
import { useIncident, useAddAction, usePublishIncident, useUpdateIncident } from "../hooks";
import { useState } from "react";
import { ActionAssignDialog } from "../components/ActionAssignDialog";
import { PublishVisibility } from "../components/PublishVisibility";
import { useAuth } from "@/lib/auth";

export default function IncidentDetailPage(){
  const { id="" } = useParams();
  const { data } = useIncident(id);
  const addAction = useAddAction(id);
  const publish = usePublishIncident(id);
  const update = useUpdateIncident(id);
  const { hasRole, profileId } = useAuth();

  const [openAssign, setOpenAssign] = useState(false);
  const canEdit = hasRole("ADMIN") || hasRole("STAFF") || (data?.incident?.reportedByProfileId === profileId);

  if (!data) return null;
  const inc = data.incident as any;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">{inc.summary}</h2>
        <span className="text-xs px-2 py-0.5 rounded border">{inc.status}</span>
        <div className="ml-auto" />
        {canEdit && (
          <PublishVisibility value={inc.visibility} onChange={(v)=>publish.mutate(v)} />
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="md:col-span-2 border rounded-2xl p-3">
          <div className="text-sm opacity-70">{new Date(inc.occurredAt).toLocaleString()} · {inc.location || "—"}</div>
          <p className="mt-2 whitespace-pre-wrap">{inc.details || "—"}</p>
          <div className="mt-3">
            <h3 className="font-semibold">Participants</h3>
            <ul className="list-disc pl-6 text-sm">
              {data.participants.map((p:any)=>(
                <li key={p.profileId+p.role}>{p.role} — {p.profileId.slice(0,8)}{p.note ? ` · ${p.note}`: ""}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Actions</h3>
            {(hasRole("ADMIN")||hasRole("STAFF")||hasRole("TEACHER")) && (
              <button className="border rounded px-2 py-1 text-xs" onClick={()=>setOpenAssign(true)}>Assigner</button>
            )}
          </div>
          <ul className="text-sm space-y-1">
            {data.actions.map((a:any)=>(
              <li key={a.id} className="border rounded px-2 py-1">
                <div className="flex items-center justify-between">
                  <span>{a.type} · {a.points} pts · {a.profileId.slice(0,8)}</span>
                  <span className="text-xs opacity-70">{a.completedAt ? "Terminé" : "En cours"}</span>
                </div>
                {a.comment && <div className="text-xs opacity-70">{a.comment}</div>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ActionAssignDialog open={openAssign} onClose={()=>setOpenAssign(false)}
        onSubmit={(payload)=>addAction.mutate(payload)} />
    </div>
  );
}
5.4 Detention Sessions (list/create/enroll/attendance)
tsx
Copier le code
// src/modules/discipline/pages/DetentionSessionsPage.tsx
import { useDetentions } from "../hooks";
import { DetentionForm } from "../components/DetentionForm";
import { DisciplineAPI } from "../api";
import { useState } from "react";
import { DetentionEnrollDrawer } from "../components/DetentionEnrollDrawer";

export default function DetentionSessionsPage(){
  const q = useDetentions();
  const [openEnroll, setOpenEnroll] = useState<string | null>(null);

  async function onCreate(payload:any){
    await DisciplineAPI.createDetention(payload);
    await q.refetch();
  }
  async function onEnroll(sessionId:string, d:{ actionId:string; studentProfileId:string }){
    await DisciplineAPI.enrollDetention(sessionId, { sessionId, ...d });
    await q.refetch();
  }
  async function onToggle(sessionId:string, studentProfileId:string, present:boolean){
    await DisciplineAPI.markDetentionAttendance(sessionId, studentProfileId, present);
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Séances de retenue</h2>
      <DetentionForm onSubmit={onCreate} />
      <div className="grid gap-3">
        {(q.data?.items || []).map((s:any)=>(
          <div key={s.id} className="border rounded-2xl p-3">
            <div className="flex items-center gap-2">
              <div className="font-semibold">{s.title}</div>
              <div className="text-sm opacity-70">{new Date(s.dateTime).toLocaleString()} · Salle {s.room || "—"} · Capacité {s.capacity}</div>
              <button className="ml-auto border rounded px-2 py-1 text-xs" onClick={()=>setOpenEnroll(s.id)}>Inscrire</button>
            </div>
            <div className="text-xs opacity-70">Enregistrements visibles après rechargement</div>
            {openEnroll===s.id && (
              <DetentionEnrollDrawer open onClose={()=>setOpenEnroll(null)} onSubmit={(d)=>onEnroll(s.id, d)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
5.5 Student View — My Record
tsx
Copier le code
// src/modules/discipline/pages/MyDisciplinePage.tsx
import { useMyRecord } from "../hooks";

export default function MyDisciplinePage(){
  const q = useMyRecord();
  const items = q.data?.items || [];
  const points = q.data?.points || 0;

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Mes incidents disciplinaires</h2>
      <div className="text-sm">Total points: <span className="font-semibold">{points}</span></div>
      <div className="space-y-2">
        {items.map((i:any)=>(
          <div key={i.id} className="border rounded-2xl p-3">
            <div className="flex items-center gap-2">
              <div className="font-medium">{i.summary}</div>
              <div className="text-xs px-2 py-0.5 rounded border">{i.status}</div>
              <div className="ml-auto text-xs opacity-70">{new Date(i.occurredAt).toLocaleString()}</div>
            </div>
            <div className="text-sm opacity-80 mt-1">{i.details || "—"}</div>
          </div>
        ))}
        {!items.length && <div className="text-sm opacity-60">Aucun incident publié.</div>}
      </div>
    </div>
  );
}
5.6 Guardian View — Child Record
tsx
Copier le code
// src/modules/discipline/pages/GuardianChildRecordPage.tsx
import { useParams } from "react-router-dom";
import { useGuardianChildRecord } from "../hooks";

export default function GuardianChildRecordPage(){
  const { studentId="" } = useParams();
  const q = useGuardianChildRecord(studentId);
  const items = q.data?.items || [];
  const points = q.data?.points || 0;

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Discipline — élève {studentId.slice(0,8)}</h2>
      <div className="text-sm">Total points: <span className="font-semibold">{points}</span></div>
      <div className="space-y-2">
        {items.map((i:any)=>(
          <div key={i.id} className="border rounded-2xl p-3">
            <div className="flex items-center gap-2">
              <div className="font-medium">{i.summary}</div>
              <div className="text-xs px-2 py-0.5 rounded border">{i.status}</div>
              <div className="ml-auto text-xs opacity-70">{new Date(i.occurredAt).toLocaleString()}</div>
            </div>
            <div className="text-sm opacity-80 mt-1">{i.details || "—"}</div>
          </div>
        ))}
        {!items.length && <div className="text-sm opacity-60">Aucun incident publié pour ce compte.</div>}
      </div>
    </div>
  );
}
6) Routes (mount into app)
tsx
Copier le code
// src/router/routes.discipline.tsx
import { RouteObject } from "react-router-dom";
import IncidentsListPage from "@/modules/discipline/pages/IncidentsListPage";
import IncidentCreatePage from "@/modules/discipline/pages/IncidentCreatePage";
import IncidentDetailPage from "@/modules/discipline/pages/IncidentDetailPage";
import DetentionSessionsPage from "@/modules/discipline/pages/DetentionSessionsPage";
import MyDisciplinePage from "@/modules/discipline/pages/MyDisciplinePage";
import GuardianChildRecordPage from "@/modules/discipline/pages/GuardianChildRecordPage";

export const disciplineRoutes: RouteObject[] = [
  { path: "/discipline/incidents", element: <IncidentsListPage /> },
  { path: "/discipline/incidents/new", element: <IncidentCreatePage /> },
  { path: "/discipline/incidents/:id", element: <IncidentDetailPage /> },
  { path: "/discipline/detention", element: <DetentionSessionsPage /> },
  { path: "/discipline/me", element: <MyDisciplinePage /> },
  { path: "/discipline/guardian/:studentId", element: <GuardianChildRecordPage /> },
];
Add to root router:

tsx
Copier le code
// src/router/index.tsx (excerpt)
import { disciplineRoutes } from "./routes.discipline";
const routes: RouteObject[] = [
  // ...
  ...disciplineRoutes,
];
Add to sidebar/menu:

Discipline

Incidents

Détention

(Students) Mon Dossier

(Guardians) Dossier de l’enfant (with a student selector you already use)

Use RBAC to conditionally show menu items.

7) i18n Strings (example)
ts
Copier le code
// src/modules/discipline/i18n.ts
export const dict = {
  fr: {
    discipline: {
      title: "Discipline",
      incidents: "Incidents",
      newIncident: "Nouvel incident",
      detention: "Séances de retenue",
      myRecord: "Mon dossier",
      visibility: { PRIVATE: "Privé", STUDENT: "Étudiant", GUARDIAN: "Parent" },
      roles: { PERPETRATOR: "Auteur", VICTIM: "Victime", WITNESS: "Témoin" },
      status: { OPEN:"Ouvert", UNDER_REVIEW:"En examen", RESOLVED:"Résolu", CANCELLED:"Annulé" }
    }
  },
  en: { /* ... */ },
  ar: { /* ... (RTL styles if you apply) */ }
};
8) End-to-End Flows (no placeholder data)
8.1 Create & Publish an Incident
Navigate Discipline → Incidents → Nouvel incident.

Fill Résumé, Date/Heure, add Participants by valid profileId (copy from your user/profile admin pages), optionally Pièces jointes (Module 7 upload).

Submit. You are redirected to detail page.

(Optional) Assign Action (e.g., DETENTION with points).

Change Visibilité to STUDENT or GUARDIAN as appropriate.

8.2 Create Detention & Enroll
Go to Discipline → Séances de retenue.

Create a session.

Click Inscrire, enter a valid detention actionId and student profileId.

Mark attendance when the session occurs → the detention action auto-completes (server logic).

8.3 Student/Guardian Views
Student: open /discipline/me to see published incidents & points.

Guardian: open /discipline/guardian/:studentId to see the child’s GUARDIAN-published incidents.

9) Definition of Done (Client)
 Routes & pages mounted; menu visible to intended roles.

 Incidents list with server-backed filtering (status).

 Create incident form (participants, attachments, details) posting to server; redirect to detail.

 Incident detail shows participants, actions, and allows:

 Assigning actions (ADMIN/STAFF/TEACHER).

 Changing visibility (ADMIN/STAFF or reporter).

 Detention sessions page:

 Create session

 Enroll with valid DETENTION actionId + student

 Mark attendance → updates server

 Student (/discipline/me) & Guardian (/discipline/guardian/:studentId) read-only views wired to server.

 Attachments upload via Module 7 local storage (presign → upload → commit) with file IDs shown and used in incidents.

 i18n keys present (fr primary).

 No placeholder data: all actions use real IDs from your DB.

10) Notes & Next Steps
Replace raw profileId fields with your People Picker once available (e.g., search by code like S434942).

Add filters in the incidents table (status, reporter = me, student).

Add CSV export for discipline logs (server small endpoint; client download button).

Display attachments with download links (via Module 7 /files/:id/download returning signed URL).

If you use RTL for Arabic, apply dir="rtl" at page root when locale === 'ar'.