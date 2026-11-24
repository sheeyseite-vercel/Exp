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

import java.io.ByteArrayOutputStream;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation;
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenter;
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

@CapacitorPlugin(name = "ExpiryNotifier")
public class ExpiryNotifierPlugin extends Plugin {
    private static final java.util.concurrent.Executor WORKER = java.util.concurrent.Executors.newSingleThreadExecutor();

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

    /** Text lines with their position, so table rows (name, quantity, price, total) can be rebuilt. */
    @PluginMethod
    public void recognizeBoxes(PluginCall call) {
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
                    .addOnSuccessListener(WORKER, result -> {
                        try {
                            JSArray boxes = new JSArray();
                            for (Text.TextBlock block : result.getTextBlocks()) {
                                for (Text.Line line : block.getLines()) {
                                    android.graphics.Rect r = line.getBoundingBox();
                                    if (r == null) continue;
                                    JSObject o = new JSObject();
                                    o.put("text", line.getText());
                                    o.put("left", r.left);
                                    o.put("top", r.top);
                                    o.put("right", r.right);
                                    o.put("bottom", r.bottom);
                                    boxes.put(o);
                                }
                            }
                            JSObject out = new JSObject();
                            out.put("boxes", boxes);
                            call.resolve(out);
                        } catch (Throwable e) {
                            call.reject(String.valueOf(e.getMessage()));
                        }
                    })
                    .addOnFailureListener(e -> call.reject(e.getMessage()));
        } catch (Throwable e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    /** Cuts the main subject out of a photo (transparent background), fully on the device. */
    @PluginMethod
    public void removeBackground(PluginCall call) {
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
            SubjectSegmenterOptions options = new SubjectSegmenterOptions.Builder()
                    .enableForegroundBitmap()
                    .build();
            SubjectSegmenter segmenter = SubjectSegmentation.getClient(options);
            segmenter.process(InputImage.fromBitmap(bmp, 0))
                    .addOnSuccessListener(WORKER, result -> {
                        try {
                            Bitmap fg = result.getForegroundBitmap();
                            if (fg == null) {
                                call.reject("no subject");
                                return;
                            }
                            ByteArrayOutputStream out = new ByteArrayOutputStream();
                            fg.compress(Bitmap.CompressFormat.PNG, 100, out);
                            JSObject o = new JSObject();
                            o.put("image", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
                            call.resolve(o);
                        } catch (Throwable e) {
                            call.reject(String.valueOf(e.getMessage()));
                        } finally {
                            segmenter.close();
                        }
                    })
                    .addOnFailureListener(e -> {
                        segmenter.close();
                        call.reject(e.getMessage());
                    });
        } catch (Throwable e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }
}
