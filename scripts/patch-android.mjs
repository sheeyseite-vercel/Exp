// Patches the generated Android project: deep link for Google sign-in, permissions, ML Kit scanner.
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs';

const file = 'android/app/src/main/AndroidManifest.xml';
let xml = readFileSync(file, 'utf8');

const permissions = [
  'android.permission.CAMERA',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.VIBRATE',
  'android.permission.SCHEDULE_EXACT_ALARM',
];
for (const p of permissions) {
  if (!xml.includes(`"${p}"`)) xml = xml.replace('</manifest>', `    <uses-permission android:name="${p}" />\n</manifest>`);
}

const filter = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="com.salahiyati.app" android:host="auth-callback" />
            </intent-filter>
`;
if (!xml.includes('auth-callback')) {
  const idx = xml.indexOf('</activity>');
  if (idx < 0) throw new Error('No </activity> found in AndroidManifest.xml');
  xml = xml.slice(0, idx) + filter + '        ' + xml.slice(idx);
}

// Google code scanner module is downloaded on demand; ask Play services to fetch it at install time.
const meta = `        <meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="barcode_ui,subject_segment" />\n`;
if (!xml.includes('com.google.mlkit.vision.DEPENDENCIES')) xml = xml.replace('</application>', `${meta}    </application>`);

// Keep the single task so the deep link returns to the running app.
if (!xml.includes('android:launchMode')) xml = xml.replace('<activity', '<activity android:launchMode="singleTask"');

// Branded notification: receivers for scheduled reminders and re-arming after reboot.
const receivers = `        <receiver android:name=".ActionReceiver" android:exported="false" />
        <receiver android:name=".ReminderReceiver" android:exported="false" />
        <receiver android:name=".BootReceiver" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
            </intent-filter>
        </receiver>
`;
if (!xml.includes('.ReminderReceiver')) xml = xml.replace('</application>', `${receivers}    </application>`);

writeFileSync(file, xml);
console.log('AndroidManifest patched');

// Native sources + resources for the custom notification.
const javaDir = 'android/app/src/main/java/com/salahiyati/app';
mkdirSync(javaDir, { recursive: true });
cpSync('native/java', javaDir, { recursive: true });
if (existsSync('native/res')) cpSync('native/res', 'android/app/src/main/res', { recursive: true });
writeFileSync(
  `${javaDir}/MainActivity.java`,
  `package com.salahiyati.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ExpiryNotifierPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`,
);
console.log('Native notifier installed');

// On-device text recognition for reading dates from photos.
const gradleFile = 'android/app/build.gradle';
let gradle = readFileSync(gradleFile, 'utf8');
if (!gradle.includes('mlkit:text-recognition')) {
  gradle = gradle.replace(/dependencies\s*\{/, "dependencies {\n    implementation 'com.google.mlkit:text-recognition:16.0.1'");
  writeFileSync(gradleFile, gradle);
}
if (!gradle.includes('subject-segmentation')) {
  gradle = gradle.replace(/dependencies\s*\{/, "dependencies {\n    implementation 'com.google.android.gms:play-services-mlkit-subject-segmentation:16.0.0-beta1'");
  writeFileSync(gradleFile, gradle);
}
console.log('Gradle patched');

// Rising versionCode so every new APK counts as an update of the previous one.
let g = readFileSync(gradleFile, 'utf8');
const build = process.env.GITHUB_RUN_NUMBER || '1';
g = g.replace(/versionCode\s+\d+/, `versionCode ${build}`).replace(/versionName\s+"[^"]*"/, `versionName "1.0.${build}"`);
writeFileSync(gradleFile, g);
console.log('Version set to', build);
