import { useEffect, useState } from 'react';
import { PHOTO_BUCKET } from '../lib/config';
import { supabase } from '../lib/supabase';

// Signed links live a week and are kept on the phone, so the same link is reused and the browser
// serves the picture from its own cache straight away. Requests made in the same moment are signed in one call.
const SIGN_SECONDS = 7 * 24 * 3600;
const KEEP_MS = 6 * 24 * 3600 * 1000;
const STORE_KEY = 'salahiyati:photo-urls';

const cache = new Map<string, { url: string; at: number }>();
try {
  const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORE_KEY);
  if (raw) for (const [path, value] of Object.entries(JSON.parse(raw) as Record<string, { url: string; at: number }>)) cache.set(path, value);
} catch {
  /* storage may be unavailable */
}

let saveTimer: number | undefined;
function persist(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      const fresh: Record<string, { url: string; at: number }> = {};
      for (const [path, value] of cache) if (Date.now() - value.at < KEEP_MS) fresh[path] = value;
      localStorage.setItem(STORE_KEY, JSON.stringify(fresh));
    } catch {
      /* ignore */
    }
  }, 400);
}

function fresh(path: string): string | null {
  const hit = cache.get(path);
  return hit && Date.now() - hit.at < KEEP_MS ? hit.url : null;
}

const waiting = new Map<string, Array<(url: string | null) => void>>();
let flushTimer: number | undefined;

function flush(): void {
  flushTimer = undefined;
  const batch = [...waiting.entries()];
  waiting.clear();
  const paths = batch.map(([path]) => path);
  void supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(paths, SIGN_SECONDS)
    .then(({ data }) => {
      const byPath = new Map<string, string>();
      for (const row of data ?? []) if (row.path && row.signedUrl) byPath.set(row.path, row.signedUrl);
      for (const [path, callbacks] of batch) {
        const url = byPath.get(path) ?? null;
        if (url) cache.set(path, { url, at: Date.now() });
        callbacks.forEach((cb) => cb(url));
      }
      persist();
    })
    .catch(() => batch.forEach(([, callbacks]) => callbacks.forEach((cb) => cb(null))));
}

function request(path: string, cb: (url: string | null) => void): void {
  const list = waiting.get(path) ?? [];
  list.push(cb);
  waiting.set(path, list);
  if (flushTimer === undefined) flushTimer = window.setTimeout(flush, 15);
}

/** Starts signing a list of photos right away, so they are ready when the screen opens. */
export function prefetchPhotos(paths: Array<string | null | undefined>): void {
  for (const path of new Set(paths)) {
    if (path && !fresh(path) && !waiting.has(path)) request(path, () => undefined);
  }
}

/** Signed URL for a private product photo, or null while loading / when there is no photo. */
export function usePhotoUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => (path ? fresh(path) : null));

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    const known = fresh(path);
    if (known) {
      setUrl(known);
      return;
    }
    let alive = true;
    request(path, (signed) => {
      if (alive && signed) setUrl(signed);
    });
    return () => {
      alive = false;
    };
  }, [path]);

  return url;
}
