import { useState } from 'react';
import { DisciplineAPI } from '../api';

export function FileUploaderM7({ onUploaded }: { onUploaded: (fileId: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true);
    try {
      const pres = await DisciplineAPI.presign(file.name, file.type || 'application/octet-stream', file.size);
      await fetch(pres.presigned.url, { method: pres.presigned.method, headers: pres.presigned.headers, body: file });
      const committed = await DisciplineAPI.commit(pres.fileId, file.size);
      onUploaded(committed.id || pres.fileId);
    } finally { setBusy(false); e.target.value = ''; }
  }
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <input type="file" className="hidden" onChange={onPick} disabled={busy} />
      <span className="border px-3 py-1 rounded">{busy ? 'Téléversement...' : 'Ajouter une pièce jointe'}</span>
    </label>
  );
}

