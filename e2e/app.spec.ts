import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const REF = 'zpffrkqbkbhmaiqaogea';
const UID = '11111111-1111-4111-8111-111111111111';
const SHOTS = 'e2e-screenshots';

function iso(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function b64(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function fakeJwt(): string {
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', aud: 'authenticated', exp })}.sig`;
}

const user = {
  id: UID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'amina@example.com',
  app_metadata: { provider: 'google' },
  user_metadata: { full_name: 'أمينة بن علي' },
  created_at: '2026-11-01T10:00:00Z',
};

interface Row {
  [key: string]: unknown;
}

function seed(): Row[] {
  const base = { user_id: UID, quantity: 1, photo_path: null, barcode: null, remind_days: null, consumed_at: null };
  const stamp = new Date().toISOString();
  return [
    { ...base, id: 'a1', name: 'حليب كامل الدسم 1 لتر', category: 'dairy', expiry_date: iso(1) },
    { ...base, id: 'a2', name: 'زبادي طبيعي', category: 'dairy', expiry_date: iso(5) },
    { ...base, id: 'a3', name: 'علبة طماطم معلّبة', category: 'canned', expiry_date: iso(60), quantity: 3 },
    { ...base, id: 'a4', name: 'خبز التوست', category: 'bakery', expiry_date: iso(-2) },
    { ...base, id: 'a5', name: 'دجاج مجمّد', category: 'meat', expiry_date: iso(20) },
  ].map((r) => ({ ...r, created_at: stamp, updated_at: stamp }));
}

async function setup(page: Page, rows: Row[], settings: Row | null = null) {
  const session = {
    access_token: fakeJwt(),
    refresh_token: 'refresh',
    token_type: 'bearer',
    expires_in: 86400,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    user,
  };
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [`sb-${REF}-auth-token`, JSON.stringify(session)] as const,
  );

  const json = (route: import('@playwright/test').Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  await page.route(`**/auth/v1/user*`, (route) => json(route, user));
  await page.route(`**/rest/v1/user_settings*`, async (route) => {
    const method = route.request().method();
    if (method === 'GET') return json(route, settings ? [settings] : []);
    const sent = route.request().postDataJSON() as Row;
    settings = { ...(settings ?? {}), ...sent };
    return json(route, [settings], 201);
  });
  await page.route(`**/rest/v1/products*`, async (route) => {
    const req = route.request();
    const method = req.method();
    if (method === 'GET') return json(route, [...rows].sort((a, b) => String(a.expiry_date).localeCompare(String(b.expiry_date))));
    if (method === 'POST') {
      const sent = req.postDataJSON() as Row;
      const row = { ...sent, id: `n${rows.length + 1}`, user_id: UID, consumed_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      rows.push(row);
      return json(route, row, 201);
    }
    if (method === 'DELETE') {
      const id = new URL(req.url()).searchParams.get('id')?.replace('eq.', '');
      const index = rows.findIndex((r) => r.id === id);
      if (index >= 0) rows.splice(index, 1);
      return route.fulfill({ status: 204 });
    }
    if (method === 'PATCH') {
      const id = new URL(req.url()).searchParams.get('id')?.replace('eq.', '');
      const target = rows.find((r) => r.id === id);
      if (target) Object.assign(target, req.postDataJSON());
      return json(route, target ?? {});
    }
    return route.continue();
  });
  await page.route('**/storage/v1/**', (route) => json(route, { error: 'not found' }, 404));
}

test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));

test('phone: browse, add manually, details, alerts, profile', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  const rows = seed();
  await setup(page, rows);

  await page.goto('/');
  await expect(page.getByText('حليب كامل الدسم 1 لتر').first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/01-home-phone.png` });

  await page.goto('/#/products');
  await expect(page.getByText('خبز التوست')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/02-products-phone.png` });

  await page.getByPlaceholder(/ابحث/).fill('زبادي');
  await expect(page.getByText('زبادي طبيعي')).toBeVisible();
  await expect(page.getByText('خبز التوست')).toHaveCount(0);
  await page.getByPlaceholder(/ابحث/).fill('');

  // add manually through the scan screen
  await page.goto('/#/product/new');
  await page.getByLabel('اسم المنتج').fill('جبن شرائح');
  await page.getByRole('button', { name: 'بعد أسبوع' }).click();
  await page.screenshot({ path: `${SHOTS}/03-form-phone.png`, fullPage: true });
  await page.getByRole('button', { name: /حفظ المنتج/ }).click();
  await expect(page.getByText('جبن شرائح')).toBeVisible();
  expect(rows.some((r) => r.name === 'جبن شرائح')).toBe(true);

  // details
  await page.getByText('حليب كامل الدسم 1 لتر').click();
  await expect(page.getByText('جدول التنبيهات')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/04-details-phone.png`, fullPage: true });

  // alerts
  await page.goto('/#/alerts');
  await expect(page.getByRole('heading', { name: 'التنبيهات' })).toBeVisible();
  const three = page.getByRole('switch', { name: 'قبل 3 أيام' });
  await expect(three).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/05-alerts-phone.png`, fullPage: true });

  await page.goto('/#/profile');
  await expect(page.getByText('amina@example.com')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/06-profile-phone.png` });

  await page.goto('/#/scan');
  await expect(page.getByText(/إدخال يدوي|يدويًا/).first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/07-scan-phone.png` });

  expect(errors).toEqual([]);
});

test('delete a product', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const rows = seed();
  await setup(page, rows);
  await page.goto('/#/product/a2');
  await page.getByRole('button', { name: 'حذف' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'حذف' }).click();
  await expect(page).toHaveURL(/#\/products/);
  expect(rows.some((r) => r.id === 'a2')).toBe(false);
});

test('tablet: sidebar layout', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await setup(page, seed());
  await page.goto('/');
  await expect(page.getByText('حليب كامل الدسم 1 لتر').first()).toBeVisible();
  await expect(page.locator('.sidebar')).toBeVisible();
  await expect(page.locator('.bottom-nav')).toBeHidden();
  await page.screenshot({ path: `${SHOTS}/08-home-tablet.png` });
});

test('signed out shows login', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/auth/v1/**', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Google/ })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/00-login-phone.png` });
});
