# CLAUDE.md — Admin Dashboard (Client)
**Vite + React (TypeScript) + Tailwind + shadcn/ui • Connected to Modules 1–5 API**

Modern, fast admin UI to manage **Identity**, **Academics**, **Enrollment**, **Teaching Assignments**, and **Attendance**.

> **Auth model reminder**  
> - Admins sign in with **email + password** (Module 1).  
> - Dashboard supports **ADMIN** and **STAFF** (limited).  
> - Backend uses **session cookies** → all fetch calls **must** use `credentials: 'include'`.

---

## 0) Deliverables

- React app (Vite) styled with Tailwind + **shadcn/ui**
- **DataGrid** (TanStack Table) with column filters & **CSV export**
- **Role-based UI** (ADMIN vs STAFF) + route guards
- Feature pages for **Modules 1–5** (API-connected)
- **Global search** (users, students, sections)
- **i18n** (default French labels; English fallback)
- **PWA**: installable + offline cache for attendance (sessions/rosters) with a simple retry queue
- Reusable **API client** (ky + zod) & global error handling
- Clean **AppShell** (sidebar + header), dark mode, toasts, forms

---

## 1) Dependencies (conceptual)
- UI: `react`, `react-router-dom`, `tailwindcss`, `shadcn/ui`, `lucide-react`, `sonner`
- Forms/State: `react-hook-form`, `@hookform/resolvers`, `zod`, `@tanstack/react-query`
- DataGrid: `@tanstack/react-table`
- Networking: `ky`
- i18n: `react-i18next`, `i18next`
- PWA: `vite-plugin-pwa`
- CSV: lightweight util (custom) or `papaparse` (optional)

---

## 2) Project Structure (client)

src/
main.tsx
app/
App.tsx
router.tsx
providers.tsx # QueryClient, i18n, Theme, Toaster
guards.tsx # RequireAuth / RequireAdmin / RequireStaffOrAdmin
shell/
AppShell.tsx
Sidebar.tsx
Header.tsx
SearchDialog.tsx # Command-style global search
lib/
api.ts # ky client (credentials + baseURL)
z.ts # zod helpers
useMe.ts # /me query hook
ui.ts # cn(), downloadCSV(), etc.
i18n.ts # i18next config (fr + en)
offlineQueue.ts # simple POST retry queue for attendance
components/
DataGrid.tsx # TanStack Table w/ filters + CSV
ConfirmDialog.tsx
CopyableSecret.tsx
FormField.tsx
features/
auth/SignIn.tsx

pgsql
Copier le code
identity/             # Module 1
  pages/UsersList.tsx
  pages/UserCreate.tsx
  pages/UserDetail.tsx
  api.ts
  schemas.ts

academics/            # Module 2
  pages/Stages.tsx
  pages/GradeLevels.tsx
  pages/YearsTerms.tsx
  pages/Subjects.tsx
  pages/Sections.tsx
  api.ts
  schemas.ts

enrollment/           # Module 3
  pages/Enrollments.tsx
  pages/GuardianLinks.tsx
  api.ts
  schemas.ts

teaching/             # Module 4
  pages/Assignments.tsx
  api.ts
  schemas.ts

attendance/           # Module 5
  pages/Sessions.tsx
  pages/TakeAttendance.tsx
  api.ts
  schemas.ts

audit/                # Timeline (optional)
  pages/AuditTimeline.tsx
  api.ts              # expects /api/admin/audit (read-only)
yaml
Copier le code

---

## 3) Providers, Guards, and Role-Based Shell

### `src/app/providers.tsx`
```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import "./../lib/i18n"; // initialize i18next
import { PropsWithChildren } from "react";

const client = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster richColors />
    </QueryClientProvider>
  );
}
src/app/guards.tsx
tsx
Copier le code
import { Navigate, Outlet } from "react-router-dom";
import { useMe } from "@/lib/useMe";

export function RequireAuth(){
  const { data, isLoading } = useMe();
  if (isLoading) return null;
  if (!data?.user) return <Navigate to="/sign-in" replace />;
  return <Outlet />;
}

export function RequireAdmin(){
  const { data, isLoading } = useMe();
  if (isLoading) return null;
  const roles = data?.user?.roles ?? [];
  return roles.includes("ADMIN") ? <Outlet/> : <Navigate to="/" replace />;
}

export function RequireStaffOrAdmin(){
  const { data, isLoading } = useMe();
  if (isLoading) return null;
  const roles = data?.user?.roles ?? [];
  return (roles.includes("ADMIN") || roles.includes("STAFF")) ? <Outlet/> : <Navigate to="/" replace />;
}
Sidebar: role-aware menu (ADMIN gets all, STAFF limited)
tsx
Copier le code
// src/app/shell/Sidebar.tsx (snippet)
const adminItems = [
  { to: "/users", labelKey: "menu.users", icon: UsersIcon },
  { to: "/academics/stages", labelKey: "menu.stages", icon: LayersIcon },
  { to: "/academics/grade-levels", labelKey: "menu.gradeLevels", icon: Layers3Icon },
  { to: "/academics/years-terms", labelKey: "menu.yearsTerms", icon: CalendarRangeIcon },
  { to: "/academics/subjects", labelKey: "menu.subjects", icon: BookIcon },
  { to: "/academics/sections", labelKey: "menu.sections", icon: LayoutGridIcon },
  { to: "/enrollment", labelKey: "menu.enrollment", icon: GraduationCapIcon },
  { to: "/enrollment/guardians", labelKey: "menu.guardians", icon: UsersRoundIcon },
  { to: "/teaching/assignments", labelKey: "menu.assignments", icon: ChalkboardIcon },
  { to: "/attendance/sessions", labelKey: "menu.attendance", icon: ClipboardCheckIcon },
  { to: "/attendance/take", labelKey: "menu.takeAttendance", icon: CheckSquareIcon },
  { to: "/audit", labelKey: "menu.audit", icon: HistoryIcon }, // optional
];

const staffItems = [
  { to: "/enrollment", labelKey: "menu.enrollment", icon: GraduationCapIcon },
  { to: "/enrollment/guardians", labelKey: "menu.guardians", icon: UsersRoundIcon },
  { to: "/attendance/sessions", labelKey: "menu.attendance", icon: ClipboardCheckIcon },
  { to: "/attendance/take", labelKey: "menu.takeAttendance", icon: CheckSquareIcon },
];

const items = roles.includes("ADMIN") ? adminItems : staffItems;
4) API Client & Helpers
src/lib/api.ts
ts
Copier le code
import ky from "ky";

export const api = ky.create({
  prefixUrl: import.meta.env.VITE_API_BASE_URL,
  credentials: "include",
  headers: { "Content-Type": "application/json" },
});

async function normalizeError(e: any) {
  const data = await e.response?.json().catch(()=>null);
  throw new Error(data?.error?.message ?? e.message ?? "Request failed");
}

export async function get<T>(url: string): Promise<T> {
  try { return await api.get(url).json<T>(); } catch (e:any){ await normalizeError(e); }
}
export async function post<T>(url: string, body?: unknown): Promise<T> {
  try { return await api.post(url, { json: body }).json<T>(); } catch (e:any){ await normalizeError(e); }
}
export async function patch<T>(url: string, body?: unknown): Promise<T> {
  try { return await api.patch(url, { json: body }).json<T>(); } catch (e:any){ await normalizeError(e); }
}
export async function del<T>(url: string): Promise<T> {
  try { return await api.delete(url).json<T>(); } catch (e:any){ await normalizeError(e); }
}
src/lib/ui.ts (CSV export + utils)
ts
Copier le code
export function downloadCSV<T extends object>(rows: T[], filename = "export.csv") {
  if (!rows.length) return;
  const headers = Object.keys(rows[0] as any);
  const csv =
    [headers.join(","), ...rows.map(r => headers.map(h => escapeCSV((r as any)[h])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
function escapeCSV(v: any) {
  if (v == null) return "";
  const s = String(v).replace(/"/g,'""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}
5) DataGrid (TanStack Table) with Filters & CSV
src/components/DataGrid.tsx
tsx
Copier le code
import * as React from "react";
import { useReactTable, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, flexRender, ColumnDef } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { downloadCSV } from "@/lib/ui";

type Props<T extends object> = {
  columns: ColumnDef<T, any>[];
  data: T[];
  filterPlaceholder?: string;
  csvName?: string;
};

export function DataGrid<T extends object>({ columns, data, filterPlaceholder="Filtrer…", csvName="export.csv" }: Props<T>) {
  const [globalFilter, setGlobalFilter] = React.useState("");
  const table = useReactTable({
    data, columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input value={globalFilter ?? ""} onChange={e=>setGlobalFilter(e.target.value)} placeholder={filterPlaceholder}/>
        <Button variant="outline" onClick={()=>downloadCSV(table.getFilteredRowModel().rows.map(r => r.original), csvName)}>CSV</Button>
      </div>

      <div className="rounded-md border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            {table.getHeaderGroups().map(hg=>(
              <tr key={hg.id}>
                {hg.headers.map(h=>(
                  <th key={h.id} className="px-3 py-2 text-left font-medium">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(r=>(
              <tr key={r.id} className="border-t">
                {r.getVisibleCells().map(c=>(
                  <td key={c.id} className="px-3 py-2">
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {table.getFilteredRowModel().rows.length} résultats
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={()=>table.previousPage()} disabled={!table.getCanPreviousPage()}>Précédent</Button>
          <Button variant="outline" size="sm" onClick={()=>table.nextPage()} disabled={!table.getCanNextPage()}>Suivant</Button>
        </div>
      </div>
    </div>
  );
}
Column-level filters can be added by setting column.getFilterFn() and rendering per-column inputs in the header; the global filter above covers most MVP needs.

6) Feature Pages (API-connected)
Keep pages simple first: DataGrid + dialogs + forms. Add filters/pagination later as needed.

Module 1 — Identity
UsersList: GET /admin/users → DataGrid (id, email/loginId, roles, active/locked). Bulk actions optional.

UserCreate: Admin: email/password; others: name only. POST /admin/users → show CopyableSecret { loginId, secret } (once).

UserDetail: GET /admin/users/:id (+ profile). Actions: Reset Secret, Rotate loginId, Activate/Deactivate, Edit Profile.

Module 2 — Academics
Stages: CRUD /academics/education-stages

GradeLevels: CRUD /academics/grade-levels?stageId=

YearsTerms: CRUD /academics/academic-years, /academics/terms?academicYearId=

Subjects: CRUD /academics/subjects?stageId=

Sections: CRUD /academics/class-sections + manage subjects (POST /academics/class-sections/:id/subjects)

Module 3 — Enrollment
Enrollments: Enroll / Transfer / Withdraw via /enrollment/* endpoints; Section roster: /enrollment/class-sections/:id/students.

GuardianLinks: Link/unlink guardians; list both directions.

Module 4 — Teaching
Assignments: CRUD /teaching/assignments; Set homeroom: /teaching/class-sections/:id/homeroom.

Module 5 — Attendance
Sessions: create/list/finalize via /attendance/*.

TakeAttendance: Day roster → GET /attendance/sections/:id/roster?date=... then bulk mark POST /attendance/sessions/:id/records.

7) Global Search (Command Palette)
UI: src/app/shell/SearchDialog.tsx
Use a shadcn Command dialog (<CommandDialog/>) bound to ⌘K / Ctrl+K.

Query minimal datasets concurrently and list grouped results.

tsx
Copier le code
// pseudo-implementation
const queries = await Promise.all([
  get<{id:string; email?:string; loginId?:string}[]>("admin/users"),
  get<{id:string; name:string}[]>("academics/class-sections"),
  get<{id:string; firstName:string; lastName:string}[]>("enrollment/students?shape=list") // or build from users+roles
]);
// Render groups: Users, Sections, Students. On select → navigate to detail page.
If you need server-side search later, add dedicated ?q= endpoints; for now, client-side fuzzy filter works for small datasets.

8) i18n (French-first)
src/lib/i18n.ts
ts
Copier le code
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const fr = {
  menu: {
    users: "Utilisateurs",
    stages: "Étapes",
    gradeLevels: "Niveaux",
    yearsTerms: "Années & Trimestres",
    subjects: "Matières",
    sections: "Classes",
    enrollment: "Inscriptions",
    guardians: "Parents/Tuteurs",
    assignments: "Affectations",
    attendance: "Présences",
    takeAttendance: "Prendre la présence",
    audit: "Historique",
  },
  actions: {
    create: "Créer",
    save: "Enregistrer",
    cancel: "Annuler",
    exportCsv: "Exporter CSV",
  },
  auth: {
    email: "Email",
    password: "Mot de passe",
    signIn: "Connexion",
  },
};

const en = { /* minimal English fallback if needed */ };

i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en } },
  lng: "fr", fallbackLng: "en", interpolation: { escapeValue: false },
});

export default i18n;
Use t("menu.users") etc. Labels in components reference translation keys.

9) PWA & Offline (attendance-focused)
vite.config.ts (plugin only)
ts
Copier le code
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "School Admin",
        short_name: "School",
        start_url: "/",
        display: "standalone",
        background_color: "#0b0b0c",
        theme_color: "#0ea5e9",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" }
        ],
      },
      workbox: {
        runtimeCaching: [
          // Cache GET attendance endpoints for quick backfill
          {
            urlPattern: ({url}) => url.pathname.startsWith("/api/attendance/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "attendance-cache",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          // Images/CSS/JS default
          {
            urlPattern: ({request}) => ["style","script","image"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "assets-cache" },
          },
        ],
      },
    }),
  ],
});
Simple POST retry queue for attendance
src/lib/offlineQueue.ts

ts
Copier le code
type Pending = { url: string; body: unknown; ts: number };

const KEY = "attendance-queue";

export function enqueue(url: string, body: unknown){
  const q: Pending[] = JSON.parse(localStorage.getItem(KEY) || "[]");
  q.push({ url, body, ts: Date.now() });
  localStorage.setItem(KEY, JSON.stringify(q));
}

export async function flushIfOnline(){
  if (!navigator.onLine) return;
  const q: Pending[] = JSON.parse(localStorage.getItem(KEY) || "[]");
  const keep: Pending[] = [];
  for (const item of q){
    try {
      const res = await fetch(item.url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.body),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      keep.push(item); // try again later
    }
  }
  localStorage.setItem(KEY, JSON.stringify(keep));
}

// attach listeners once (e.g., in App.tsx)
window.addEventListener("online", () => { flushIfOnline(); });
Usage: when calling POST /attendance/sessions/:id/records, if it fails with network error, call enqueue(url, body) and toast “enregistré hors ligne; sera envoyé plus tard”.

10) Audit Log Timeline (optional but included in UI)
If your backend exposes GET /api/admin/audit?entityType=&entityId=&limit=... returning a list like:

json
Copier le code
[{ "id":"...", "at":"2025-06-01T10:00:00Z", "who":"userId", "action":"ENROLL_CREATE", "summary":"Inscription de Amina en 2nde A", "meta":{...}}]
render it as a vertical timeline with day grouping. If the endpoint is absent, hide the menu entry.

src/features/audit/pages/AuditTimeline.tsx (sketch)

tsx
Copier le code
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";

export default function AuditTimeline(){
  const { data } = useQuery({ queryKey: ["audit"], queryFn: () => get<any[]>("admin/audit?limit=200") });
  if (!data) return null;
  return (
    <div className="space-y-4">
      {data.map(ev=>(
        <div key={ev.id} className="flex gap-3">
          <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
          <div>
            <div className="text-sm">{new Date(ev.at).toLocaleString()}</div>
            <div className="font-medium">{ev.summary}</div>
            {ev.meta && <pre className="text-xs text-muted-foreground">{JSON.stringify(ev.meta, null, 2)}</pre>}
          </div>
        </div>
      ))}
    </div>
  );
}
11) Auth (Sign-In page)
Form (email, password) → POST /auth/login-email

On success: invalidate ["me"], navigate to /

UI: shadcn Card, Form, Input, Button, show errors via sonner toast.

tsx
Copier le code
// simplified submit
await post("auth/login-email", { email, password });
toast.success("Bienvenue !");
queryClient.invalidateQueries({ queryKey: ["me"] });
navigate("/");
12) Role-Based Access Summary
ADMIN: full menu & pages.

STAFF: Enrollment + Attendance (read/write), read-only Academics listing if desired.

Guards:

Routes under /teaching/* and /academics/* can be wrapped in <RequireAdmin/>.

Enrollment/Attendance can be wrapped in <RequireStaffOrAdmin/>.

13) Definition of Done (Client)
 All API calls use credentials: "include"; 401 → redirect to /sign-in.

 AppShell with role-based Sidebar; Header includes Search (⌘K) and theme toggle.

 Identity screens: list/create/detail; reset secret; rotate loginId; status toggle; profile edit.

 Academics screens: stages, grade levels, years/terms, subjects, sections (+ manage section subjects).

 Enrollment: enroll/transfer/withdraw; roster; guardian links.

 Teaching: assignments CRUD; set homeroom.

 Attendance: sessions CRUD; take attendance with roster; bulk mark.

 DataGrid provides global filter + CSV export for tables.

 Global search across users/sections/students with Command dialog.

 i18n: French labels, English fallback.

 PWA: installable; GET attendance endpoints cached; offline queue for POST records.

 (If backend supports) Audit timeline visible and populated.

14) Notes
For larger datasets, move search/filter server-side (add ?q=&limit=&cursor= to your APIs).

If you later allow teacher logins, reuse the same app with route guards to expose only their assignments & attendance.

Extend the offline queue to use IndexedDB and backoff if you expect prolonged offline usage.