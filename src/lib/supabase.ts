import { Capacitor } from '@capacitor/core';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

export const isNative = Capacitor.isNativePlatform();

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    // On the phone the sign-in result comes back through a deep link, handled in the data provider.
    detectSessionInUrl: !isNative,
  },
});
