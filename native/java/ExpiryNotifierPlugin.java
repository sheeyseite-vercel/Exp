package com.salahiyati.app;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

@CapacitorPlugin(name = "ExpiryNotifier")
public class ExpiryNotifierPlugin extends Plugin {
    @PluginMethod
    public void schedule(PluginCall call) {
        JSArray items = call.getArray("items");
        if (items == null) {
            call.reject("items required");
            return;
        }
        Notifier.saveImages(getContext(), call.getObject("images"));
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

    @PluginMethod
    public void takeActions(PluginCall call) {
        JSObject out = new JSObject();
        out.put("actions", Notifier.takeActions(getContext()));
        call.resolve(out);
    }

    @PluginMethod
    public void recognizeText(PluginCall call) {
        String image = call.getString("image");
        if (image == null) {
            call.reject("image required");
            return;
        }
        try {
            byte[] bytes = Base64.decode(image, Base64.DEFAULT);
            Bitmap bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (bmp == null) {
                call.reject("bad image");
                return;
            }
            TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
                    .process(InputImage.fromBitmap(bmp, 0))
                    .addOnSuccessListener(result -> {
                        JSObject out = new JSObject();
                        out.put("text", result.getText());
                        call.resolve(out);
                    })
                    .addOnFailureListener(e -> call.reject(e.getMessage()));
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }
}
