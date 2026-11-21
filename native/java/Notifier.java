package com.salahiyati.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.RectF;
import android.util.Base64;
import java.io.File;
import java.io.FileOutputStream;
import java.util.Iterator;
import android.os.Build;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONObject;

final class Notifier {
    static final String CHANNEL = "expired_reminders";
    private static final String PREFS = "expired_plan";
    private static final String KEY = "items";

    private Notifier() {}

    static void ensureChannel(Context ctx, String name) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, name, NotificationManager.IMPORTANCE_HIGH);
        ch.enableVibration(true);
        ch.setLightColor(0xFF3B6FF0);
        nm.createNotificationChannel(ch);
    }

    static void show(Context ctx, JSONObject item) {
        ensureChannel(ctx, item.optString("channel", "Expired"));
        String title = item.optString("title");
        String body = item.optString("body");
        String chip = item.optString("chip");
        int id = item.optInt("id");
        String label = chip.isEmpty() ? title : title + " \u00b7 " + chip;
        RemoteViews small = new RemoteViews(ctx.getPackageName(), R.layout.notif_small);
        small.setTextViewText(R.id.title, label);
        small.setTextViewText(R.id.body, body);
        Bitmap photo = loadPhoto(ctx, item.optString("productId"));
        if (photo != null) small.setImageViewBitmap(R.id.logo, photo);

        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (open != null) open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap = PendingIntent.getActivity(ctx, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_expired)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
                .setCustomContentView(small)
                .setCustomBigContentView(small)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setAutoCancel(true)
                .setContentIntent(tap);
        try {
            NotificationManagerCompat.from(ctx).notify(id, b.build());
        } catch (SecurityException ignored) {
            // notification permission not granted
        }
    }

    private static File photoFile(Context ctx, String productId) {
        return new File(ctx.getFilesDir(), "notif_" + productId.replaceAll("[^A-Za-z0-9_-]", "") + ".jpg");
    }

    static void saveImages(Context ctx, org.json.JSONObject images) {
        File[] old = ctx.getFilesDir().listFiles((d, n) -> n.startsWith("notif_") && n.endsWith(".jpg"));
        if (old != null) for (File f : old) f.delete();
        if (images == null) return;
        Iterator<String> keys = images.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            try (FileOutputStream out = new FileOutputStream(photoFile(ctx, key))) {
                out.write(Base64.decode(images.getString(key), Base64.DEFAULT));
            } catch (Exception ignored) {
            }
        }
    }

    private static Bitmap loadPhoto(Context ctx, String productId) {
        if (productId == null || productId.isEmpty()) return null;
        File f = photoFile(ctx, productId);
        if (!f.exists()) return null;
        Bitmap src = BitmapFactory.decodeFile(f.getAbsolutePath());
        if (src == null) return null;
        int px = 144;
        Bitmap out = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(out);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        c.drawRoundRect(new RectF(0, 0, px, px), px * 0.28f, px * 0.28f, p);
        p.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
        c.drawBitmap(Bitmap.createScaledBitmap(src, px, px, true), 0, 0, p);
        return out;
    }

    private static PendingIntent alarmIntent(Context ctx, int id, JSONObject item, boolean create) {
        Intent i = new Intent(ctx, ReminderReceiver.class);
        i.setAction("com.salahiyati.app.REMINDER");
        if (item != null) i.putExtra("item", item.toString());
        int flags = PendingIntent.FLAG_IMMUTABLE | (create ? PendingIntent.FLAG_UPDATE_CURRENT : PendingIntent.FLAG_NO_CREATE);
        return PendingIntent.getBroadcast(ctx, id, i, flags);
    }

    static void cancelAll(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        try {
            JSONArray old = new JSONArray(sp.getString(KEY, "[]"));
            for (int n = 0; n < old.length(); n++) {
                int id = old.getJSONObject(n).optInt("id");
                PendingIntent pi = alarmIntent(ctx, id, null, false);
                if (pi != null && am != null) {
                    am.cancel(pi);
                    pi.cancel();
                }
            }
        } catch (Exception ignored) {
        }
        sp.edit().remove(KEY).apply();
    }

    static void scheduleAll(Context ctx, JSONArray items) {
        cancelAll(ctx);
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, items.toString()).apply();
        arm(ctx, items);
    }

    /** Re-arms stored reminders (after reboot). */
    static void rearm(Context ctx) {
        try {
            arm(ctx, new JSONArray(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "[]")));
        } catch (Exception ignored) {
        }
    }

    private static void arm(Context ctx, JSONArray items) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        long now = System.currentTimeMillis();
        for (int n = 0; n < items.length(); n++) {
            try {
                JSONObject item = items.getJSONObject(n);
                long at = item.optLong("at");
                if (at <= now) continue;
                PendingIntent pi = alarmIntent(ctx, item.optInt("id"), item, true);
                if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            } catch (Exception ignored) {
            }
        }
    }
}
