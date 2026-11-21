package com.salahiyati.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationManagerCompat;

public class ActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String act = intent.getStringExtra("act");
        int nid = intent.getIntExtra("nid", 0);
        NotificationManagerCompat.from(context).cancel(nid);
        if ("used".equals(act)) {
            Notifier.queueAction(context, intent.getStringExtra("productId"), "used");
        } else if ("snooze".equals(act)) {
            Notifier.snooze(context, intent.getStringExtra("item"));
        }
    }
}
