// The Supabase URL and publishable key are public by design: access is enforced by row level security.
export const SUPABASE_URL: string =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://zpffrkqbkbhmaiqaogea.supabase.co';
export const SUPABASE_KEY: string =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_zcKCmxLyn4FPrQXr9kytQQ_jMYlT8WF';

export const APP_SCHEME = 'com.salahiyati.app';
export const AUTH_REDIRECT_NATIVE = `${APP_SCHEME}://auth-callback`;
export const PHOTO_BUCKET = 'product-photos';
