import { useEffect, useState } from 'react';

export function ServiceStatus({ admin }: { admin: boolean }) {
  const [state, setState] = useState('Memeriksa koneksi layanan…');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    setState('Memeriksa koneksi layanan…');
    fetch('/api/v1/health/ready', { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('unavailable');
        const body: unknown = await response.json();
        if (!body || typeof body !== 'object' || !('status' in body) || body.status !== 'ready') throw new Error('invalid');
        setState('Layanan pengembangan terhubung');
      }).catch(() => { if (!cancelled) setState('Layanan belum terhubung. Silakan coba lagi.'); })
      .finally(() => clearTimeout(timeout));
    let cancelled = false;
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
  }, [attempt]);
  return <div className={admin ? "piui-field" : "hd-service-status"}><p role="status">{state}</p><button className={admin ? "piui-btn piui-btn--secondary piui-btn--sm" : "btn btn-secondary"} type="button" onClick={() => setAttempt(n => n + 1)}>Periksa koneksi</button></div>;
}
