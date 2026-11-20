import { useEffect, useState } from 'react';
import { PHOTO_BUCKET } from '../lib/config';
import { supabase } from '../lib/supabase';

const cache = new Map<string, { url: string; at: number }>();
const TTL_MS = 50 * 60 * 1000;

/** Signed URL for a private product photo, or null while loading / when there is no photo. */
export function usePhotoUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    const hit = path ? cache.get(path) : undefined;
    return hit && Date.now() - hit.at < TTL_MS ? hit.url : null;
  });

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    const hit = cache.get(path);
    if (hit && Date.now() - hit.at < TTL_MS) {
      setUrl(hit.url);
      return;
    }
    let alive = true;
    void supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!alive || !data) return;
        cache.set(path, { url: data.signedUrl, at: Date.now() });
        setUrl(data.signedUrl);
      });
    return () => {
      alive = false;
    };
  }, [path]);

  return url;
}
