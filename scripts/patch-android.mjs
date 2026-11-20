// Patches the generated Android project: deep link for Google sign-in, permissions, ML Kit scanner.
import { readFileSync, writeFileSync } from 'node:fs';

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
const meta = `        <meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="barcode_ui" />\n`;
if (!xml.includes('com.google.mlkit.vision.DEPENDENCIES')) xml = xml.replace('</application>', `${meta}    </application>`);

// Keep the single task so the deep link returns to the running app.
if (!xml.includes('android:launchMode')) xml = xml.replace('<activity', '<activity android:launchMode="singleTask"');

writeFileSync(file, xml);
console.log('AndroidManifest patched');
