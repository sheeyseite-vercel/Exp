package com.salahiyati.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONObject;

public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            String raw = intent.getStringExtra("item");
            if (raw != null) Notifier.show(context, new JSONObject(raw));
        } catch (Exception ignored) {
        }
    }
}
