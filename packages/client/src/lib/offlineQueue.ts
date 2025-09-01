type Pending = { url: string; body: unknown; ts: number };

const KEY = 'attendance-queue';

export function enqueue(url: string, body: unknown) {
  const q: Pending[] = JSON.parse(localStorage.getItem(KEY) || '[]');
  q.push({ url, body, ts: Date.now() });
  localStorage.setItem(KEY, JSON.stringify(q));
}

export async function flushIfOnline() {
  if (!navigator.onLine) return;
  const q: Pending[] = JSON.parse(localStorage.getItem(KEY) || '[]');
  const keep: Pending[] = [];
  for (const item of q) {
    try {
      const res = await fetch(item.url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.body),
      });
      if (!res.ok) throw new Error('failed');
    } catch {
      keep.push(item); // try again later
    }
  }
  localStorage.setItem(KEY, JSON.stringify(keep));
}

// attach listeners once (e.g., in App.tsx)
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushIfOnline();
  });
}