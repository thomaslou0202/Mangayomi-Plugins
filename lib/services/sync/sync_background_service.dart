import 'dart:io';

import 'package:flutter/services.dart';
import 'package:mangayomi/l10n/generated/app_localizations.dart';
import 'package:permission_handler/permission_handler.dart';

/// Keeps the existing Flutter process eligible to finish a user-started sync
/// when Android backgrounds the Activity. No account data goes to native code.
class SyncBackgroundService {
  static const _channel = MethodChannel('com.kodjodevf.mangayomi.sync');
  static bool _askedNotifications = false;
  static Future<void> start(
    AppLocalizations? l10n, {
    bool askNotifications = false,
  }) async {
    if (!Platform.isAndroid) return;
    if (askNotifications && !_askedNotifications) {
      _askedNotifications = true;
      if (await Permission.notification.isDenied) {
        await Permission.notification.request();
      }
    }
    await _channel.invokeMethod<void>('start', {
      'title': l10n?.sync_starting ?? 'Mangayomi sync',
      'text': l10n?.sync_progress_indeterminate ?? 'Syncing in background',
    });
  }

  static Future<void> stop() async {
    if (!Platform.isAndroid) return;
    // Cleanup must never mask a sync result or leave its progress active.
    try {
      await _channel.invokeMethod<void>('stop');
    } on PlatformException {
      /* Service already stopped. */
    }
  }
}
