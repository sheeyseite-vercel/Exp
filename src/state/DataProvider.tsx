import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import type { PluginListenerHandle } from '@capacitor/core';
import type { Session, User } from '@supabase/supabase-js';
import { AUTH_REDIRECT_NATIVE, PHOTO_BUCKET } from '../lib/config';
import { daysUntil } from '../lib/dates';
import { t } from '../lib/i18n';
import { syncNotifications, takeNotifierActions, type PermissionState } from '../lib/notifications';
import { isNative, supabase } from '../lib/supabase';
import { DEFAULT_SETTINGS, type Outcome, type Product, type ProductInput, type Settings } from '../lib/types';

interface DataContextValue {
  authReady: boolean;
  session: Session | null;
  user: User | null;
  authError: string | null;
  /** Products that have not been marked as consumed. */
  products: Product[];
  consumedCount: number;
  /** Products already used up or thrown away. */
  history: Product[];
  settings: Settings;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  lastSync: Date | null;
  permission: PermissionState;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  saveProduct: (input: ProductInput, photo?: Blob | null, id?: string) => Promise<Product>;
  removeProduct: (id: string) => Promise<void>;
  consumeProduct: (id: string, outcome?: Outcome) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

function cacheKey(uid: string): string {
  return `salahiyati:cache:${uid}`;
}

function describeError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
  return t('unexpected_error');
}

function sortByExpiry(list: Product[]): Product[] {
  return [...list].sort((a, b) => a.expiry_date.localeCompare(b.expiry_date) || a.name.localeCompare(b.name));
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [all, setAll] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [permission, setPermission] = useState<PermissionState>('unsupported');

  const allRef = useRef<Product[]>([]);
  allRef.current = all;
  const settingsRef = useRef<Settings>(settings);
  settingsRef.current = settings;

  const user = session?.user ?? null;
  const uid = user?.id ?? null;

  // --- Auth session -------------------------------------------------------------------------
  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setAuthReady(true);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // --- Deep link back from Google sign-in, and the Android back button -------------------------
  useEffect(() => {
    if (!isNative) return;
    const handles: PluginListenerHandle[] = [];
    let alive = true;

    void CapApp.addListener('appUrlOpen', async ({ url }) => {
      if (!url.startsWith(AUTH_REDIRECT_NATIVE)) return;
      await Browser.close().catch(() => undefined);
      const parsed = new URL(url);
      const failure = parsed.searchParams.get('error_description');
      if (failure) {
        setAuthError(failure);
        return;
      }
      const code = parsed.searchParams.get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) setAuthError(exchangeError.message);
      }
    }).then((handle) => (alive ? handles.push(handle) : void handle.remove()));

    void CapApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else void CapApp.exitApp();
    }).then((handle) => (alive ? handles.push(handle) : void handle.remove()));

    return () => {
      alive = false;
      handles.forEach((handle) => void handle.remove());
    };
  }, []);

  // --- Data loading -----------------------------------------------------------------------
  const load = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [productsResult, settingsResult] = await Promise.all([
        supabase.from('products').select('*').order('expiry_date', { ascending: true }),
        supabase.from('user_settings').select('*').maybeSingle(),
      ]);
      if (productsResult.error) throw productsResult.error;
      if (settingsResult.error) throw settingsResult.error;

      const nextSettings: Settings = { ...DEFAULT_SETTINGS, ...(settingsResult.data ?? {}) };
      let nextProducts = productsResult.data as Product[];

      if (nextSettings.auto_delete_expired) {
        const stale = nextProducts.filter((p) => !p.consumed_at && daysUntil(p.expiry_date) < 0).map((p) => p.id);
        if (stale.length > 0) {
          const { error: deleteError } = await supabase.from('products').delete().in('id', stale);
          if (!deleteError) nextProducts = nextProducts.filter((p) => !stale.includes(p.id));
        }
      }

      setAll(sortByExpiry(nextProducts));
      setSettings(nextSettings);
      setLastSync(new Date());
      try {
        localStorage.setItem(cacheKey(userId), JSON.stringify({ products: nextProducts, settings: nextSettings }));
      } catch {
        /* storage may be unavailable */
      }
    } catch (failure) {
      let restored = false;
      try {
        const raw = localStorage.getItem(cacheKey(userId));
        if (raw) {
          const cached = JSON.parse(raw) as { products: Product[]; settings: Settings };
          setAll(sortByExpiry(cached.products));
          setSettings({ ...DEFAULT_SETTINGS, ...cached.settings });
          restored = true;
        }
      } catch {
        /* ignore a broken cache */
      }
      setError(restored ? t('offline_cache') : describeError(failure));
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!uid) {
      setAll([]);
      setSettings(DEFAULT_SETTINGS);
      setLoaded(false);
      setLastSync(null);
      return;
    }
    void load(uid);
  }, [uid, load]);

  const refresh = useCallback(async () => {
    if (uid) await load(uid);
  }, [uid, load]);

  // --- Keep device reminders in step with the data ---------------------------------------------
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      void syncNotifications(all, settings)
        .then((result) => setPermission(result.permission))
        .catch(() => undefined);
    }, 400);
    return () => clearTimeout(timer);
  }, [all, settings, loaded]);

  // --- Actions --------------------------------------------------------------------------------
  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    const redirectTo = isNative ? AUTH_REDIRECT_NATIVE : window.location.origin + window.location.pathname;
    const { data, error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: isNative, queryParams: { prompt: 'select_account' } },
    });
    if (signInError) {
      setAuthError(signInError.message);
      return;
    }
    if (isNative && data.url) await Browser.open({ url: data.url });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const saveProduct = useCallback(
    async (input: ProductInput, photo?: Blob | null, id?: string): Promise<Product> => {
      if (!uid) throw new Error(t('login_first'));
      const previous = id ? allRef.current.find((p) => p.id === id) : undefined;
      let photoPath: string | null =
        input.photo_path !== undefined ? input.photo_path : (previous?.photo_path ?? null);

      if (photo) {
        const path = `${uid}/${crypto.randomUUID()}.jpg`;
        const upload = await supabase.storage.from(PHOTO_BUCKET).upload(path, photo, {
          contentType: 'image/jpeg',
          upsert: false,
        });
        if (upload.error) throw upload.error;
        photoPath = path;
      }

      const row = {
        name: input.name.trim(),
        category: input.category,
        expiry_date: input.expiry_date,
        quantity: input.quantity,
        barcode: input.barcode,
        remind_days: input.remind_days,
        location: input.location,
        photo_path: photoPath,
      };

      const query = id
        ? supabase.from('products').update(row).eq('id', id).select().single()
        : supabase.from('products').insert(row).select().single();
      const { data, error: saveError } = await query;
      if (saveError) throw saveError;
      const saved = data as Product;

      if (previous?.photo_path && previous.photo_path !== photoPath) {
        const stillUsed = allRef.current.some((p) => p.id !== id && p.photo_path === previous.photo_path);
        if (!stillUsed) void supabase.storage.from(PHOTO_BUCKET).remove([previous.photo_path]);
      }
      setAll((current) => sortByExpiry(id ? current.map((p) => (p.id === id ? saved : p)) : [...current, saved]));
      return saved;
    },
    [uid],
  );

  const removeProduct = useCallback(async (id: string) => {
    const target = allRef.current.find((p) => p.id === id);
    const { error: deleteError } = await supabase.from('products').delete().eq('id', id);
    if (deleteError) throw deleteError;
    const photoShared = allRef.current.some((p) => p.id !== id && p.photo_path === target?.photo_path);
    if (target?.photo_path && !photoShared) void supabase.storage.from(PHOTO_BUCKET).remove([target.photo_path]);
    setAll((current) => current.filter((p) => p.id !== id));
  }, []);

  const consumeProduct = useCallback(async (id: string, outcome: Outcome = 'used') => {
    const consumedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('products')
      .update({ consumed_at: consumedAt, outcome })
      .eq('id', id);
    if (updateError) throw updateError;
    setAll((current) => current.map((p) => (p.id === id ? { ...p, consumed_at: consumedAt, outcome } : p)));
  }, []);

  // --- Actions tapped inside notifications (applied when the app is next open) -----------------
  useEffect(() => {
    if (!isNative || !loaded) return;
    let alive = true;
    const drain = async () => {
      const actions = await takeNotifierActions();
      for (const action of actions) {
        if (!alive) return;
        if (allRef.current.some((p) => p.id === action.productId && !p.consumed_at)) {
          await consumeProduct(action.productId, action.action).catch(() => undefined);
        }
      }
    };
    void drain();
    let handle: PluginListenerHandle | undefined;
    void CapApp.addListener('resume', () => void drain()).then((h) => (handle = h));
    return () => {
      alive = false;
      void handle?.remove();
    };
  }, [loaded, consumeProduct]);

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      if (!uid) return;
      const next: Settings = { ...settingsRef.current, ...patch };
      setSettings(next);
      const { error: upsertError } = await supabase.from('user_settings').upsert(
        {
          user_id: uid,
          notifications_enabled: next.notifications_enabled,
          default_remind_days: next.default_remind_days,
          custom_days: next.custom_days,
          notify_time: next.notify_time,
          auto_delete_expired: next.auto_delete_expired,
          daily_digest: next.daily_digest,
          weekly_digest: next.weekly_digest,
          weekly_day: next.weekly_day,
        },
        { onConflict: 'user_id' },
      );
      if (upsertError) setError(describeError(upsertError));
    },
    [uid],
  );

  const updateDisplayName = useCallback(async (name: string) => {
    const { data, error: updateError } = await supabase.auth.updateUser({ data: { display_name: name.trim() } });
    if (updateError) throw updateError;
    setSession((current) => (current && data.user ? { ...current, user: data.user } : current));
  }, []);

  const value = useMemo<DataContextValue>(
    () => ({
      authReady,
      session,
      user,
      authError,
      products: all.filter((p) => !p.consumed_at),
      consumedCount: all.filter((p) => p.consumed_at).length,
      history: all.filter((p) => p.consumed_at),
      settings,
      loading,
      loaded,
      error,
      lastSync,
      permission,
      signInWithGoogle,
      signOut,
      refresh,
      saveProduct,
      removeProduct,
      consumeProduct,
      updateSettings,
      updateDisplayName,
    }),
    [
      authReady,
      session,
      user,
      authError,
      all,
      settings,
      loading,
      loaded,
      error,
      lastSync,
      permission,
      signInWithGoogle,
      signOut,
      refresh,
      saveProduct,
      removeProduct,
      consumeProduct,
      updateSettings,
      updateDisplayName,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const value = useContext(DataContext);
  if (!value) throw new Error('useData must be used inside DataProvider');
  return value;
}
