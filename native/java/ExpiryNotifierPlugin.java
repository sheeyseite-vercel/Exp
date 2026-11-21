package com.salahiyati.app;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ExpiryNotifier")
public class ExpiryNotifierPlugin extends Plugin {
    @PluginMethod
    public void schedule(PluginCall call) {
        JSArray items = call.getArray("items");
        if (items == null) {
            call.reject("items required");
            return;
        }
        Notifier.scheduleAll(getContext(), items);
        call.resolve();
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        Notifier.cancelAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void showNow(PluginCall call) {
        JSObject item = call.getData();
        Notifier.show(getContext(), item);
        call.resolve();
    }
}
