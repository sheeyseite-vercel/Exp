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
                    .enableMultipleSubjects(new SubjectSegmenterOptions.SubjectResultOptions.Builder().enableSubjectBitmap().build())
                    .build();
            SubjectSegmenter segmenter = SubjectSegmentation.getClient(options);
            segmenter.process(InputImage.fromBitmap(bmp, 0))
                    .addOnSuccessListener(result -> {
                        try {
                            Bitmap fg = result.getForegroundBitmap();
                            // Prefer the one subject that is big and near the centre (the product), so a hand or the table is dropped.
                            java.util.List<com.google.mlkit.vision.segmentation.subject.Subject> subjects = result.getSubjects();
                            if (subjects != null && subjects.size() > 1) {
                                double best = -1;
                                com.google.mlkit.vision.segmentation.subject.Subject pick = null;
                                double cx = bmp.getWidth() / 2.0;
                                double cy = bmp.getHeight() / 2.0;
                                for (com.google.mlkit.vision.segmentation.subject.Subject sj : subjects) {
                                    if (sj.getBitmap() == null) continue;
                                    double mx = sj.getStartX() + sj.getWidth() / 2.0 - cx;
                                    double my = sj.getStartY() + sj.getHeight() / 2.0 - cy;
                                    double dist = Math.sqrt(mx * mx + my * my) / Math.max(bmp.getWidth(), bmp.getHeight());
                                    double score = ((double) sj.getWidth() * sj.getHeight()) * (1.0 - Math.min(0.9, dist * 1.6));
                                    if (score > best) {
                                        best = score;
                                        pick = sj;
                                    }
                                }
                                if (pick != null) {
                                    Bitmap canvasBmp = Bitmap.createBitmap(bmp.getWidth(), bmp.getHeight(), Bitmap.Config.ARGB_8888);
                                    new android.graphics.Canvas(canvasBmp).drawBitmap(pick.getBitmap(), pick.getStartX(), pick.getStartY(), null);
                                    fg = canvasBmp;
                                }
                            }
                            if (fg == null) {
                                call.reject("no subject");
                                return;
                            }
                            ByteArrayOutputStream out = new ByteArrayOutputStream();
                            fg.compress(Bitmap.CompressFormat.PNG, 100, out);
                            JSObject o = new JSObject();
                            o.put("image", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
                            call.resolve(o);
                        } catch (Exception e) {
                            call.reject(e.getMessage());
                        } finally {
                            segmenter.close();
                        }
                    })
                    .addOnFailureListener(e -> {
                        segmenter.close();
                        call.reject(e.getMessage());
                    });
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }
}
