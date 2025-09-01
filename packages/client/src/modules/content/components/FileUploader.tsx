
import { useRef, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ContentAPI } from '../api';
import { MAX_FILE_MB } from '@/lib/env';
import { sha256Hex } from '@/lib/hash';

export function FileUploader({ onUploaded }: { onUploaded: (fileId: string) => void }) {
  const [progress, setProgress] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  function openPicker() {
    inputRef.current?.click();
  }

  function cancelUpload() {
    try {
      xhrRef.current?.abort();
      toast.message('Téléversement annulé');
    } catch {
      /* no-op */
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      const msg = `Taille maximale ${MAX_FILE_MB}MB`;
      setError(msg);
      toast.error(msg);
      return;
    }
    setBusy(true);
    setProgress(0);
    toast.message('Démarrage du téléversement…');
    try {
      const sha = await sha256Hex(f).catch(() => undefined);
      const presign = await ContentAPI.presign({ filename: f.name, mime: f.type || 'application/octet-stream', sizeBytes: f.size, sha256: sha });

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open('POST', presign.presigned.url, true);
        // Ensure session cookies are sent to the upload endpoint (required by requireAuth middleware)
        xhr.withCredentials = true;
        // Apply any presigned headers if provided by the server
        if (presign.presigned.headers) {
          for (const [k, v] of Object.entries(presign.presigned.headers)) {
            try { xhr.setRequestHeader(k, v); } catch (err) { void err; }
          }
        }
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const pct = Math.round((evt.loaded/evt.total)*100);
            setProgress(pct);
          }
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error(`Échec du téléversement (${xhr.status})`));
        xhr.onerror = () => reject(new Error('Erreur réseau lors du téléversement'));
        xhr.onabort = () => reject(new Error('Téléversement annulé'));
        xhr.send(f);
      });

      await ContentAPI.commit({ fileId: presign.fileId, sizeBytes: f.size, sha256: sha });
      onUploaded(presign.fileId);
      setProgress(100);
      toast.success('Fichier téléversé');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Le téléversement a échoué';
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
      xhrRef.current = null;
      // clear file input so selecting the same file again triggers onChange
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" className="hidden" onChange={handleSelect} disabled={busy} />
      <div className="flex items-center gap-2">
        <Button type="button" onClick={openPicker} disabled={busy}>
          {busy ? `Téléversement… ${progress}%` : 'Choisir un fichier'}
        </Button>
        {busy && (
          <Button type="button" variant="outline" onClick={cancelUpload}>
            Annuler
          </Button>
        )}
      </div>
      {busy && <Progress value={progress} />}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}