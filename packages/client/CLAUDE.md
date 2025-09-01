# CLAUDE.module-6-admin-utils.client.md
**Module 6 (Client) — Audit Log & Global Search**
_Client: Vite + React (TS), Tailwind, shadcn/ui, TanStack Query/Table, i18n (fr/ar/en)_

This module adds two admin utilities to the dashboard UI:

1) **Audit Log Timeline** — browse/filter/paginate events recorded by the server.  
2) **Global Search** — search across users, students, teachers, and sections (guardians optional).

> **Auth & RBAC**
> - **Audit** screens are **ADMIN-only**.
> - **Global Search** may be **ADMIN** or **STAFF** (follow your server policy).
> - All requests use `credentials: "include"` session cookies.

---

## 0) File Map (client-only)

src/
features/
admin-utils/
api.ts # HTTP calls for audit/search
schemas.ts # zod types
pages/
AuditTimeline.tsx # infinite timeline with filters
SearchPage.tsx # global search page with tabs/grid
components/
AuditFilters.tsx
AuditEventCard.tsx
SearchDialog.tsx # ⌘K command palette (uses search API)

yaml
Copier le code

> Assumes you already have:
> - `src/lib/api.ts` (ky wrapper), `src/lib/ui.ts` (downloadCSV), `src/app/router.tsx`, `src/app/guards.tsx`, `src/app/shell/Header.tsx`
> - shadcn/ui components and TanStack Query setup from the dashboard module

---

## 1) Data Contracts (aligns with server Module 6)

### 1.1 Zod Schemas
`src/features/admin-utils/schemas.ts`
```ts
import { z } from "zod";

export const AuditItem = z.object({
  id: z.string().uuid(),
  at: z.string(), // ISO
  actorUserId: z.string().uuid().nullable(),
  actorRoles: z.array(z.string()).nullable().optional(),
  ip: z.string().nullable().optional(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().uuid().nullable(),
  summary: z.string(),
  meta: z.any().nullable(),
});
export type AuditItem = z.infer<typeof AuditItem>;

export const AuditListResponse = z.object({
  items: z.array(AuditItem),
  nextCursor: z
    .object({ cursorAt: z.string(), cursorId: z.string().uuid() })
    .nullable(),
});
export type AuditListResponse = z.infer<typeof AuditListResponse>;

export const SearchBuckets = z.object({
  users: z.array(z.object({ id: z.string().uuid(), email: z.string().nullable(), loginId: z.string().nullable(), isActive: z.boolean().nullable().optional() })).optional(),
  students: z.array(z.object({ profileId: z.string().uuid(), firstName: z.string(), lastName: z.string(), userId: z.string().uuid() })).optional(),
  teachers: z.array(z.object({ profileId: z.string().uuid(), firstName: z.string(), lastName: z.string(), userId: z.string().uuid() })).optional(),
  sections: z.array(z.object({ id: z.string().uuid(), name: z.string(), gradeLevelId: z.string().uuid(), academicYearId: z.string().uuid() })).optional(),
  guardians: z.array(z.object({ profileId: z.string().uuid(), firstName: z.string(), lastName: z.string(), userId: z.string().uuid() })).optional(),
});
export type SearchBuckets = z.infer<typeof SearchBuckets>;
2) API Client
src/features/admin-utils/api.ts

ts
Copier le code
import { get } from "@/lib/api";
import { AuditListResponse, SearchBuckets } from "./schemas";

export type AuditQuery = {
  entityType?: string;
  entityId?: string;
  action?: string;
  actorUserId?: string;
  from?: string; // ISO date
  to?: string;   // ISO date
  q?: string;    // text search
  limit?: number;
  cursorAt?: string;
  cursorId?: string;
};

function qs(obj: Record<string, any>) {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k,v]) => {
    if (v === undefined || v === null || v === "") return;
    p.set(k, String(v));
  });
  return p.toString();
}

export async function fetchAudit(q: AuditQuery) {
  const res = await get<unknown>(`admin/audit?${qs({ limit: 50, ...q })}`);
  return AuditListResponse.parse(res);
}

export async function searchGlobal(q: { q: string; types?: string; limit?: number }) {
  const res = await get<unknown>(`admin/search?${qs({ limit: 20, ...q })}`);
  return SearchBuckets.parse(res);
}
3) Components
3.1 Audit Filters
src/features/admin-utils/components/AuditFilters.tsx

tsx
Copier le code
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker"; // if you have; else use <Input type="date" />
import { cn } from "@/lib/ui";

type Props = {
  initial?: {
    action?: string;
    entityType?: string;
    actorUserId?: string;
    from?: string;
    to?: string;
    q?: string;
  };
  onApply: (q: Props["initial"]) => void;
  className?: string;
};

export default function AuditFilters({ initial, onApply, className }: Props) {
  const [action, setAction] = useState(initial?.action ?? "");
  const [entityType, setEntityType] = useState(initial?.entityType ?? "");
  const [actorUserId, setActorUserId] = useState(initial?.actorUserId ?? "");
  const [from, setFrom] = useState(initial?.from ?? "");
  const [to, setTo] = useState(initial?.to ?? "");
  const [q, setQ] = useState(initial?.q ?? "");

  return (
    <div className={cn("grid gap-2 md:grid-cols-6", className)}>
      <div className="col-span-2">
        <Label>Action</Label>
        <Input value={action} onChange={e=>setAction(e.target.value)} placeholder="e.g., ENROLL_CREATE" />
      </div>
      <div className="col-span-2">
        <Label>Entity</Label>
        <Input value={entityType} onChange={e=>setEntityType(e.target.value)} placeholder="e.g., ENROLLMENT" />
      </div>
      <div className="col-span-2">
        <Label>Actor (userId)</Label>
        <Input value={actorUserId} onChange={e=>setActorUserId(e.target.value)} placeholder="uuid…" />
      </div>

      <div>
        <Label>From</Label>
        <Input type="date" value={from} onChange={e=>setFrom(e.target.value)} />
      </div>
      <div>
        <Label>To</Label>
        <Input type="date" value={to} onChange={e=>setTo(e.target.value)} />
      </div>
      <div className="md:col-span-2">
        <Label>Search</Label>
        <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="text…" />
      </div>
      <div className="flex items-end">
        <Button className="w-full" onClick={() => onApply({ action, entityType, actorUserId, from, to, q })}>
          Apply
        </Button>
      </div>
    </div>
  );
}
3.2 Audit Event Card (grouped timeline)
src/features/admin-utils/components/AuditEventCard.tsx

tsx
Copier le code
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuditItem } from "../schemas";

export default function AuditEventCard({ item }: { item: AuditItem }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <span className="px-2 py-0.5 text-[10px] rounded bg-muted">{item.action}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-xs">{new Date(item.at).toLocaleString()}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <div className="font-medium">{item.summary}</div>
        <div className="text-xs text-muted-foreground">
          {item.entityType}{item.entityId ? ` • ${item.entityId}` : ""} {item.actorUserId ? `• actor ${item.actorUserId}` : ""}
          {item.ip ? ` • ip ${item.ip}` : ""}
        </div>
        {item.meta ? (
          <pre className="text-xs bg-muted rounded p-2 overflow-x-auto">{JSON.stringify(item.meta, null, 2)}</pre>
        ) : null}
      </CardContent>
    </Card>
  );
}
3.3 Command Palette (⌘K) — Global Search
src/features/admin-utils/components/SearchDialog.tsx

tsx
Copier le code
import * as React from "react";
import { searchGlobal } from "../api";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

type Props = { open: boolean; onOpenChange: (v:boolean)=>void };

export default function SearchDialog({ open, onOpenChange }: Props){
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<any>({});
  const nav = useNavigate();

  React.useEffect(() => {
    function onKey(e: KeyboardEvent){
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k"){
        e.preventDefault(); onOpenChange(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  async function run(){
    if (q.trim().length < 2) return;
    setLoading(true);
    try {
      const res = await searchGlobal({ q, types: "users,students,teachers,sections", limit: 8 });
      setData(res);
    } finally { setLoading(false); }
  }

  function go(path: string){
    onOpenChange(false);
    nav(path);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0">
        <div className="p-3 border-b">
          <Input autoFocus value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter" && run()} placeholder="Search users, students, sections…" />
        </div>
        <ScrollArea className="max-h-[60vh] p-3">
          {loading ? <div className="p-4 flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Searching…</div> : (
            <div className="grid md:grid-cols-2 gap-3">
              {data.users?.length ? (
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Users</div>
                  <ul className="space-y-1">
                    {data.users.map((u:any)=>(
                      <li key={u.id} className="p-2 rounded hover:bg-muted cursor-pointer"
                          onClick={()=>go(`/users/${u.id}`)}>
                        {u.email ?? u.loginId ?? u.id}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {data.students?.length ? (
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Students</div>
                  <ul className="space-y-1">
                    {data.students.map((s:any)=>(
                      <li key={s.profileId} className="p-2 rounded hover:bg-muted cursor-pointer"
                          onClick={()=>go(`/students/${s.profileId}`)}>
                        {s.firstName} {s.lastName}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {data.teachers?.length ? (
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Teachers</div>
                  <ul className="space-y-1">
                    {data.teachers.map((t:any)=>(
                      <li key={t.profileId} className="p-2 rounded hover:bg-muted cursor-pointer"
                          onClick={()=>go(`/teachers/${t.profileId}`)}>
                        {t.firstName} {t.lastName}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {data.sections?.length ? (
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Sections</div>
                  <ul className="space-y-1">
                    {data.sections.map((c:any)=>(
                      <li key={c.id} className="p-2 rounded hover:bg-muted cursor-pointer"
                          onClick={()=>go(`/academics/sections?focus=${c.id}`)}>
                        {c.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {!loading && !data.users?.length && !data.students?.length && !data.teachers?.length && !data.sections?.length && q &&
                <div className="text-sm text-muted-foreground px-2">No matches</div>}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
4) Pages
4.1 Audit Timeline (infinite scroll + filters + CSV)
src/features/admin-utils/pages/AuditTimeline.tsx

tsx
Copier le code
import * as React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchAudit } from "../api";
import AuditFilters from "../components/AuditFilters";
import AuditEventCard from "../components/AuditEventCard";
import { Button } from "@/components/ui/button";
import { downloadCSV } from "@/lib/ui";
import { Loader2 } from "lucide-react";

function groupByDate(items: any[]) {
  const map = new Map<string, any[]>();
  for (const it of items) {
    const d = new Date(it.at);
    const key = d.toISOString().slice(0,10); // YYYY-MM-DD
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }
  return Array.from(map.entries()).sort((a,b)=> a[0] < b[0] ? 1 : -1);
}

export default function AuditTimeline(){
  const [filters, setFilters] = React.useState<any>({});
  const qKey = ["audit", filters];

  const query = useInfiniteQuery({
    queryKey: qKey,
    queryFn: ({ pageParam }) => fetchAudit({ ...filters, ...(pageParam ?? {}) }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialPageParam: undefined as any,
  });

  const pages = query.data?.pages ?? [];
  const all = pages.flatMap(p => p.items);
  const groups = groupByDate(all);

  function exportCsv(){
    downloadCSV(all.map(i => ({
      id: i.id, at: i.at, action: i.action, entityType: i.entityType, entityId: i.entityId,
      actorUserId: i.actorUserId, ip: i.ip, summary: i.summary
    })), "audit.csv");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Audit</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
          <Button variant="outline" onClick={()=>query.refetch()}>Refresh</Button>
        </div>
      </div>

      <AuditFilters onApply={(f)=>{ setFilters(f); }} className="mb-2" />

      {query.isLoading ? (
        <div className="p-8 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="space-y-6">
          {groups.map(([day, items]) => (
            <section key={day} className="space-y-2">
              <div className="text-sm font-semibold">{new Date(day).toLocaleDateString()}</div>
              <div className="grid gap-2">
                {items.map((it:any)=> <AuditEventCard key={it.id} item={it} />)}
              </div>
            </section>
          ))}
          {query.hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button onClick={()=>query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                {query.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
          {!query.hasNextPage && all.length > 0 && (
            <div className="text-center text-xs text-muted-foreground py-2">No more results</div>
          )}
        </div>
      )}
    </div>
  );
}
4.2 Global Search Page (tabs + grids + CSV)
src/features/admin-utils/pages/SearchPage.tsx

tsx
Copier le code
import * as React from "react";
import { searchGlobal } from "../api";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { downloadCSV } from "@/lib/ui";
import { Link } from "react-router-dom";

export default function SearchPage(){
  const [q, setQ] = React.useState("");
  const [types, setTypes] = React.useState("users,students,teachers,sections");
  const query = useQuery({
    queryKey: ["admin-search", q, types],
    queryFn: () => searchGlobal({ q, types, limit: 50 }),
    enabled: q.trim().length >= 2
  });

  const data = query.data ?? {};
  const tabs = [
    ["users", data.users ?? []],
    ["students", data.students ?? []],
    ["teachers", data.teachers ?? []],
    ["sections", data.sections ?? []],
  ] as const;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Global Search</h1>

      <div className="flex gap-2 items-center">
        <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="Type at least 2 characters…" className="max-w-lg" />
        <Button variant="outline" onClick={() => q && query.refetch()} disabled={q.trim().length < 2}>Search</Button>
        <Button variant="outline" onClick={() => {
          const flat = [
            ...(data.users ?? []).map((x:any)=>({ bucket:"user", id:x.id, label:x.email ?? x.loginId ?? x.id })),
            ...(data.students ?? []).map((x:any)=>({ bucket:"student", id:x.profileId, label:`${x.firstName} ${x.lastName}` })),
            ...(data.teachers ?? []).map((x:any)=>({ bucket:"teacher", id:x.profileId, label:`${x.firstName} ${x.lastName}` })),
            ...(data.sections ?? []).map((x:any)=>({ bucket:"section", id:x.id, label:x.name })),
          ];
          downloadCSV(flat, "search.csv");
        }}>Export CSV</Button>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          {tabs.map(([k, arr])=>(
            <TabsTrigger key={k} value={k}>{k} ({arr.length})</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="users">
          <div className="rounded border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr><th className="px-3 py-2 text-start">ID</th><th className="px-3 py-2 text-start">Email</th><th className="px-3 py-2 text-start">Login ID</th></tr>
              </thead>
              <tbody>
                {(data.users ?? []).map((u:any)=>(
                  <tr key={u.id} className="border-t hover:bg-muted/40">
                    <td className="px-3 py-2"><Link className="underline" to={`/users/${u.id}`}>{u.id}</Link></td>
                    <td className="px-3 py-2">{u.email ?? "—"}</td>
                    <td className="px-3 py-2">{u.loginId ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="students">
          <div className="rounded border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr><th className="px-3 py-2 text-start">Profile</th><th className="px-3 py-2 text-start">Name</th></tr>
              </thead>
              <tbody>
                {(data.students ?? []).map((s:any)=>(
                  <tr key={s.profileId} className="border-t hover:bg-muted/40">
                    <td className="px-3 py-2"><Link className="underline" to={`/students/${s.profileId}`}>{s.profileId}</Link></td>
                    <td className="px-3 py-2">{s.firstName} {s.lastName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="teachers">
          <div className="rounded border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr><th className="px-3 py-2 text-start">Profile</th><th className="px-3 py-2 text-start">Name</th></tr>
              </thead>
              <tbody>
                {(data.teachers ?? []).map((t:any)=>(
                  <tr key={t.profileId} className="border-t hover:bg-muted/40">
                    <td className="px-3 py-2"><Link className="underline" to={`/teachers/${t.profileId}`}>{t.profileId}</Link></td>
                    <td className="px-3 py-2">{t.firstName} {t.lastName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="sections">
          <div className="rounded border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr><th className="px-3 py-2 text-start">ID</th><th className="px-3 py-2 text-start">Name</th></tr>
              </thead>
              <tbody>
                {(data.sections ?? []).map((c:any)=>(
                  <tr key={c.id} className="border-t hover:bg-muted/40">
                    <td className="px-3 py-2"><Link className="underline" to={`/academics/sections?focus=${c.id}`}>{c.id}</Link></td>
                    <td className="px-3 py-2">{c.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
5) Router & Shell Integration
5.1 Routes
Add both pages to your router behind guards:

tsx
Copier le code
// src/app/router.tsx (excerpt)
import AuditTimeline from "@/features/admin-utils/pages/AuditTimeline";
import SearchPage from "@/features/admin-utils/pages/SearchPage";
import { RequireAdmin, RequireStaffOrAdmin } from "./guards";

{
  element: <RequireAdmin />, children: [
    { path: "audit", element: <AuditTimeline /> },
  ]
},
{
  element: <RequireStaffOrAdmin />, children: [
    { path: "search", element: <SearchPage /> },
  ]
}
5.2 Sidebar & Header
Add “Audit” (ADMIN only) and “Search” (ADMIN/STAFF) entries in Sidebar.

Mount SearchDialog in Header and wire ⌘K / Ctrl+K:

tsx
Copier le code
// src/app/shell/Header.tsx (excerpt)
import SearchDialog from "@/features/admin-utils/components/SearchDialog";
const [open, setOpen] = useState(false);
<LanguageSwitcher />
<Button variant="outline" onClick={()=>setOpen(true)}>⌘K</Button>
<SearchDialog open={open} onOpenChange={setOpen} />
6) i18n Keys (add to fr/en/ar)
src/locales/fr.json

json
Copier le code
{
  "audit": {
    "title": "Historique",
    "filters": { "action":"Action", "entity":"Entité", "actor":"Acteur", "from":"Du", "to":"Au", "search":"Recherche", "apply":"Appliquer" },
    "exportCsv": "Exporter CSV",
    "refresh": "Rafraîchir",
    "loadMore": "Charger plus",
    "noMore": "Plus de résultats"
  },
  "search": {
    "title": "Recherche globale",
    "placeholder": "Saisir au moins 2 caractères…",
    "exportCsv": "Exporter CSV",
    "users":"Utilisateurs",
    "students":"Élèves",
    "teachers":"Enseignants",
    "sections":"Classes",
    "noMatches":"Aucun résultat"
  }
}
Mirror the same keys in en.json and ar.json (RTL handled globally).

Replace hard-coded English strings in components with t("audit.*")/t("search.*") if you want full localization now.

7) UX Notes
Audit: Keep meta collapsed if large; here we show it inline for simplicity.

Search: The page supports CSV export; the palette is for quick nav.

For big datasets, switch to server-side paging (the APIs already support limits).

8) Manual Tests
Log in as ADMIN.

Go to /audit — you should see recent actions (create a user/enrollment to generate).

Filter by action=ENROLL_CREATE, set a date range, and Apply. Verify results tighten.

Click Load more until No more results.

Click Export CSV and open the file; columns should be populated.

Open /search, type “am” (≥2 chars), verify results in each tab.

Use ⌘K / Ctrl+K and search “sec” → select a section to navigate.

9) Definition of Done (Client Module 6)
 Route /audit (ADMIN) with filters, infinite pagination, CSV export.

 Route /search (ADMIN/STAFF) with multi-bucket results and CSV export.

 Command palette bound to ⌘K/Ctrl+K using /admin/search.

 Error states handled (toasts/snackbars if you prefer).

 i18n keys added; RTL behaves under Arabic.

 Menu visibility respects RBAC.

10) Future Enhancements
Add column filters and sorting to the audit list with TanStack Table if you prefer a grid view.

Add entity/action dropdowns fed by /admin/audit?distinct=entityType|action.

Deep links from audit rows to the affected entity detail pages.

Save/restore last-used filters in localStorage.