import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:html/parser.dart' as html;
import 'package:mangayomi/modules/novel/utils/novel_paginator.dart';
import 'package:mangayomi/modules/novel/widgets/novel_illustration.dart';

Widget reader(ImageProvider image, {double? maxHeight}) => MaterialApp(
  home: Scaffold(
    body: SingleChildScrollView(
      child: SizedBox(
        width: 300,
        child: NovelIllustration(
          image: image,
          maxHeight: maxHeight,
          errorLabel: 'Unable to load illustration',
          retryLabel: 'Retry',
          semanticLabel: 'Illustration',
        ),
      ),
    ),
  ),
);

class IllustrationProvider extends ImageProvider<IllustrationProvider> {
  IllustrationProvider({this.failFirst = false});
  final bool failFirst;
  int attempts = 0;

  @override
  Future<IllustrationProvider> obtainKey(ImageConfiguration configuration) =>
      SynchronousFuture(this);

  @override
  ImageStreamCompleter loadImage(
    IllustrationProvider key,
    ImageDecoderCallback decode,
  ) {
    attempts++;
    if (failFirst && attempts == 1) {
      return OneFrameImageStreamCompleter(Future.error(StateError('HTTP 503')));
    }
    final recorder = ui.PictureRecorder();
    Canvas(recorder).drawRect(const Rect.fromLTWH(0, 0, 600, 1200), Paint());
    final picture = recorder.endRecording();
    final image = picture.toImageSync(600, 1200);
    picture.dispose();
    return OneFrameImageStreamCompleter(
      SynchronousFuture(ImageInfo(image: image)),
    );
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  tearDown(() => PaintingBinding.instance.imageCache.clear());

  testWidgets(
    'online illustration shows in the body at its natural aspect ratio',
    (tester) async {
      await tester.pumpWidget(reader(IllustrationProvider()));
      await tester.pump();
      final image = find.byType(RawImage);
      expect(image, findsOneWidget);
      expect(tester.widget<RawImage>(image).image, isNotNull);
      expect(tester.getSize(image), const Size(300, 600));
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('portrait illustration fits within a paged reader viewport', (
    tester,
  ) async {
    await tester.pumpWidget(reader(IllustrationProvider(), maxHeight: 180));
    await tester.pump();
    expect(
      tester.getSize(find.byType(RawImage)).height,
      lessThanOrEqualTo(180),
    );
    expect(
      tester.getSize(find.byType(NovelIllustration)).height,
      lessThanOrEqualTo(196),
    );
    expect(tester.widget<RawImage>(find.byType(RawImage)).fit, BoxFit.contain);
    expect(tester.takeException(), isNull);
  });

  testWidgets('a failed image offers retry and can load on the next attempt', (
    tester,
  ) async {
    final provider = IllustrationProvider(failFirst: true);
    await tester.pumpWidget(reader(provider));
    await tester.pump();
    expect(find.text('Unable to load illustration'), findsOneWidget);
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(provider.attempts, 2);
    expect(find.text('Unable to load illustration'), findsNothing);
    expect(tester.widget<RawImage>(find.byType(RawImage)).image, isNotNull);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'EPUB memory images continue to render through the shared widget',
    (tester) async {
      final recorder = ui.PictureRecorder();
      Canvas(recorder).drawRect(const Rect.fromLTWH(0, 0, 2, 3), Paint());
      final picture = recorder.endRecording();
      final decoded = picture.toImageSync(2, 3);
      final bytes = await tester.runAsync(
        () => decoded.toByteData(format: ui.ImageByteFormat.png),
      );
      picture.dispose();
      decoded.dispose();
      final image = MemoryImage(bytes!.buffer.asUint8List());
      await tester.pumpWidget(reader(image));
      await tester.runAsync(() async {
        await precacheImage(
          image,
          tester.element(find.byType(NovelIllustration)),
        );
      });
      await tester.pumpAndSettle();
      expect(tester.widget<RawImage>(find.byType(RawImage)).image, isNotNull);
      expect(tester.takeException(), isNull);
    },
  );

  test(
    'image URLs resolve against the actual chapter, including relative sources',
    () {
      Uri? resolve(
        String src, {
        String? chapter = '/novel/3/3152/138935.htm',
      }) => resolveNovelImageUri(
        src: src,
        chapterUrl: chapter,
        sourceBaseUrl: 'https://www.wenku8.net',
      );
      expect(
        resolve('../images/1.jpg').toString(),
        'https://www.wenku8.net/novel/3/images/1.jpg',
      );
      expect(
        resolve('//pic.wenku8.com/a.jpg').toString(),
        'https://pic.wenku8.com/a.jpg',
      );
      expect(
        resolve('https://pic.wenku8.com/a.jpg').toString(),
        'https://pic.wenku8.com/a.jpg',
      );
      for (final src in [
        '',
        'javascript:alert(1)',
        'file:///C:/secret.jpg',
        'data:image/png;base64,AAA',
        'https://user:password@example.test/a.jpg',
      ]) {
        expect(resolve(src), isNull);
      }
    },
  );

  test('illustration-only chapters keep every image on separate pages in source order', () {
    final images = List.generate(
      17,
      (i) => '<img src="https://pic.wenku8.com/$i.jpg"><br>',
    ).join();
    final source =
        '<div id="readerViewContent"><article>$images</article></div>';
    for (final height in [200.0, 600.0]) {
      final result = NovelPaginator.paginate(
        htmlContent: source,
        pageWidth: 300,
        pageHeight: height,
        fontSize: 16,
        lineHeight: 1.5,
      );
      expect(result.pageCount, 17);
      for (var i = 0; i < 17; i++) {
        final images = html.parse(result.pages[i]).querySelectorAll('img');
        expect(images, hasLength(1));
        expect(
          images.single.attributes['src'],
          'https://pic.wenku8.com/$i.jpg',
        );
      }
    }
  });

  test(
    'CDN requests have a browser identity and preserve source-specific headers',
    () {
      final chapter = Uri.parse(
        'https://www.wenku8.net/novel/3/3152/138935.htm',
      );
      final source = {'Referer': 'https://www.wenku8.net/'};
      final headers = novelImageHeaders(
        sourceHeaders: source,
        userAgent: 'Configured browser',
        chapterUri: chapter,
      );
      expect(headers['User-Agent'], 'Configured browser');
      expect(headers['Referer'], 'https://www.wenku8.net/');
      expect(source, hasLength(1));
      final explicit = novelImageHeaders(
        sourceHeaders: {
          'user-agent': 'Source browser',
          'referer': 'https://source.test/',
        },
        userAgent: 'Configured browser',
        chapterUri: chapter,
      );
      expect(explicit, {
        'user-agent': 'Source browser',
        'referer': 'https://source.test/',
      });
      final fallback = novelImageHeaders(
        sourceHeaders: {},
        userAgent: 'Configured browser',
        chapterUri: chapter,
      );
      expect(fallback['Referer'], chapter.toString());
      expect(
        novelImageHeaders(
          sourceHeaders: {},
          userAgent: '"Configured browser"',
        )['User-Agent'],
        'Configured browser',
      );
      expect(
        novelImageHeaders(
          sourceHeaders: {},
          userAgent: '  ',
        ).containsKey('User-Agent'),
        isFalse,
      );
    },
  );

  test('paragraph and link wrapped images retain surrounding text and TTS positions', () {
    const source =
        '<div id="readerViewContent"><article><p data-tts-index="0">Before illustration.</p>'
        '<p><a href="https://example.test"><img src="https://pic.wenku8.com/a.jpg"></a><br>'
        '<span><img src="https://pic.wenku8.com/b.jpg"></span></p>'
        '<p data-tts-index="1">After illustration.</p></article></div>';
    final result = NovelPaginator.paginate(
      htmlContent: source,
      pageWidth: 300,
      pageHeight: 350,
      fontSize: 16,
      lineHeight: 1.5,
    );
    expect(result.pageCount, 4);
    expect(result.pages.first, contains('Before illustration.'));
    expect(result.pages[1], contains('/a.jpg'));
    expect(result.pages[2], contains('/b.jpg'));
    expect(result.pages.last, contains('After illustration.'));
    expect(result.blockToPageMap[0], 0);
    expect(result.blockToPageMap[1], 3);
  });
}
