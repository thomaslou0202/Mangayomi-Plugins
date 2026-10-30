import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mangayomi/l10n/generated/app_localizations.dart';
import 'package:mangayomi/utils/language.dart';

void main() {
  test('Traditional Chinese covers every template key and placeholder', () {
    final english = jsonDecode(
      File('lib/l10n/app_en.arb').readAsStringSync(),
    ) as Map<String, dynamic>;
    final traditional = jsonDecode(
      File('lib/l10n/app_zh_TW.arb').readAsStringSync(),
    ) as Map<String, dynamic>;
    final keys = english.keys.where((k) => !k.startsWith('@')).toSet();
    expect(traditional.keys.where((k) => !k.startsWith('@')).toSet(), keys);
    expect(traditional['@@locale'], 'zh_TW');
    for (final key in keys) {
      expect(traditional[key], isNotEmpty, reason: key);
      final metadata = english['@$key'] as Map<String, dynamic>?;
      final placeholders =
          metadata?['placeholders'] as Map<String, dynamic>? ?? {};
      for (final placeholder in placeholders.keys) {
        expect(
          traditional[key],
          matches(RegExp(r'\{' + RegExp.escape(placeholder) + r'\s*[,}]')),
          reason: '$key: $placeholder',
        );
      }
    }
  });

  test('Taiwan locale is distinct from existing Simplified Chinese', () {
    expect(
      AppLocalizations.supportedLocales,
      contains(const Locale('zh', 'TW')),
    );
    expect(completeLanguageName('zh-TW'), '繁體中文（台灣）');
    expect(completeLanguageName('zh'), '简体中文');
    final traditional = lookupAppLocalizations(const Locale('zh', 'TW'));
    final simplified = lookupAppLocalizations(const Locale('zh'));
    expect(traditional.library, '書庫');
    expect(traditional.settings, '設定');
    expect(traditional.restore_backup, '還原備份');
    expect(traditional.extensions, '擴充套件');
    expect(traditional.image_loading_error, '無法載入此圖片');
    expect(simplified.library, '图书馆');
  });

  test('Counts, error details and named values survive localization', () {
    final l10n = lookupAppLocalizations(const Locale('zh', 'TW'));
    for (final n in [0, 1, 2, 100]) {
      expect(l10n.n_episodes(n), '$n集');
      expect(l10n.mass_migration_item_count(n), '$n 個項目');
    }
    expect(
      l10n.watch_order_source_community_list('清單甲', '作者乙'),
      contains('作者乙'),
    );
    expect(l10n.backup_failed('TEST-123'), '備份失敗：TEST-123');
    expect(l10n.skip_seconds('+10'), '+10 秒');
    expect(
      l10n.delete_source_confirm_message(2, 10, 3, 4),
      contains('4 筆更新紀錄'),
    );
    expect(
      l10n.merge_manga_preview_message(20, 3, 17, 2),
      contains('2 個重複的追蹤連結'),
    );
  });

  testWidgets(
    'Language can switch to Traditional Chinese and back on phone and tablet',
    (tester) async {
      addTearDown(() => tester.view.resetPhysicalSize());
      addTearDown(() => tester.view.resetDevicePixelRatio());
      tester.view.devicePixelRatio = 1;
      for (final size in [const Size(390, 844), const Size(1280, 800)]) {
        tester.view.physicalSize = size;
        for (final locale in [
          const Locale('zh', 'TW'),
          const Locale('en'),
          const Locale('zh', 'TW'),
        ]) {
          await tester.pumpWidget(
            MaterialApp(
              locale: locale,
              supportedLocales: AppLocalizations.supportedLocales,
              localizationsDelegates: AppLocalizations.localizationsDelegates,
              home: Builder(
                builder: (context) {
                  final l10n = AppLocalizations.of(context)!;
                  return Scaffold(
                    body: SingleChildScrollView(
                      child: Column(
                        children: [
                          Text(l10n.library),
                          Text(l10n.app_language),
                          Text(l10n.add_repo_warning),
                          Text(l10n.restore_sync_question_message),
                          TextButton(
                            onPressed: () {},
                            child: Text(l10n.resolve_challenge),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          );
          await tester.pumpAndSettle();
          expect(
            find.text(locale.languageCode == 'en' ? 'Library' : '書庫'),
            findsOneWidget,
          );
          expect(tester.takeException(), isNull);
        }
      }
    },
  );
}
