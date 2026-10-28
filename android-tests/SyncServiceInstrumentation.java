package com.kodjodevf.mangayomi;

import android.app.Instrumentation;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import java.io.ByteArrayOutputStream;
import java.io.FileInputStream;

/** Black-box device checks; works against optimized release APKs. */
public class SyncServiceInstrumentation extends Instrumentation {
    private static final String SERVICE = "com.kodjodevf.mangayomi.SyncBackgroundService";
    @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }

    private String shell(String command) throws Exception {
        ParcelFileDescriptor fd = getUiAutomation().executeShellCommand(command);
        try (FileInputStream input = new ParcelFileDescriptor.AutoCloseInputStream(fd);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            return output.toString("UTF-8");
        }
    }
    private void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
    private boolean serviceRunning() throws Exception {
        String state = shell("dumpsys activity services " + getTargetContext().getPackageName());
        return state.contains(SERVICE) && state.contains("isForeground=true");
    }
    private boolean cpuHeld() throws Exception {
        String tag = getTargetContext().getPackageName() + ":sync";
        for (String line : shell("dumpsys power").split("\n")) {
            if (line.contains("PARTIAL_WAKE_LOCK") && line.contains(tag)) return true;
        }
        return false;
    }
    @Override public void onStart() {
        Bundle result = new Bundle();
        Intent service = new Intent().setClassName(getTargetContext().getPackageName(), SERVICE);
        try {
            Intent launch = getTargetContext().getPackageManager()
                .getLaunchIntentForPackage(getTargetContext().getPackageName());
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getTargetContext().startActivity(launch);
            SystemClock.sleep(3000);
            service.putExtra("title", "同步背景服務測試");
            service.putExtra("text", "驗證切換 App、關閉螢幕與完成後清理");
            if (Build.VERSION.SDK_INT >= 26) getTargetContext().startForegroundService(service);
            else getTargetContext().startService(service);
            SystemClock.sleep(3000);
            check(serviceRunning(), "service did not enter foreground");
            check(cpuHeld(), "CPU wake lock not held");
            shell("input keyevent KEYCODE_HOME");
            SystemClock.sleep(3000);
            check(serviceRunning(), "service stopped in background");
            shell("input keyevent KEYCODE_SLEEP");
            SystemClock.sleep(5000);
            check(serviceRunning(), "service stopped with screen off");
            check(cpuHeld(), "wake lock released early");
            getTargetContext().stopService(service);
            for (int i = 0; i < 20 && (serviceRunning() || cpuHeld()); i++) SystemClock.sleep(250);
            check(!serviceRunning(), "service did not stop");
            check(!cpuHeld(), "wake lock leaked");
            result.putString("stream", "BACKGROUND_SYNC_SERVICE_PASSED: native foreground status, home, screen off, CPU wake lock, cleanup\n");
            finish(-1, result);
        } catch (Throwable error) {
            result.putString("stream", "BACKGROUND_SYNC_SERVICE_FAILED: " + error + "\n");
            finish(0, result);
        } finally {
            getTargetContext().stopService(service);
            try { shell("input keyevent KEYCODE_WAKEUP"); } catch (Exception ignored) { }
        }
    }
}
