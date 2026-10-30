import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mangayomi/modules/manga/detail/widgets/detail_action_strip.dart';

void main() {
  testWidgets(
    'comments sits after related titles and is tappable at every size',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      final tapped = <String>[];
      for (final width in [320.0, 390.0, 800.0, 1280.0]) {
        tester.view.physicalSize = Size(width, 800);
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: DetailActionStrip(
                actions: [
                  for (final label in ['推薦', '相關作品', '評論'])
                    DetailAction(
                      icon: Icons.chat_bubble_outline,
                      label: label,
                      onPressed: () => tapped.add(label),
                    ),
                ],
              ),
            ),
          ),
        );
        final recommendation = tester.getCenter(find.text('推薦'));
        final related = tester.getCenter(find.text('相關作品'));
        final comments = tester.getCenter(find.text('評論'));
        expect(recommendation.dx, lessThan(related.dx));
        expect(related.dx, lessThan(comments.dx));
        expect(comments.dy, related.dy);
        await tester.tap(find.text('評論'));
        expect(tapped.last, '評論');
        expect(tester.takeException(), isNull);
      }
      expect(tapped, List.filled(4, '評論'));
    },
  );

  testWidgets('extra anime actions and large labels wrap without overflow', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 800);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(textScaler: TextScaler.linear(2)),
          child: Scaffold(
            body: DetailActionStrip(
              actions: [
                for (final label in [
                  'Recommendations',
                  'Related titles',
                  'Comments',
                  'Watch order',
                  'Sequels',
                ])
                  DetailAction(
                    icon: Icons.chat_bubble_outline,
                    label: label,
                    onPressed: () {},
                  ),
              ],
            ),
          ),
        ),
      ),
    );
    expect(
      tester.getCenter(find.text('Watch order')).dy,
      greaterThan(tester.getCenter(find.text('Comments')).dy),
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('unavailable comment URLs have a disabled action', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: DetailActionStrip(
            actions: [
              DetailAction(
                icon: Icons.chat_bubble_outline,
                label: '評論',
                onPressed: null,
              ),
            ],
          ),
        ),
      ),
    );
    expect(tester.widget<InkWell>(find.byType(InkWell)).onTap, isNull);
    await tester.tap(find.text('評論'));
    expect(tester.takeException(), isNull);
  });
}
