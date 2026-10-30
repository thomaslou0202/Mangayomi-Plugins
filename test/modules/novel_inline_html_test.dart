import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_html/flutter_html.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mangayomi/modules/novel/widgets/novel_illustration.dart';

class FixtureImage extends ImageProvider<FixtureImage> {
  const FixtureImage();
  @override
  Future<FixtureImage> obtainKey(ImageConfiguration configuration) =>
      SynchronousFuture(this);
  @override
  ImageStreamCompleter loadImage(
    FixtureImage key,
    ImageDecoderCallback decode,
  ) {
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    canvas.drawRect(
      const Rect.fromLTWH(0, 0, 600, 1200),
      Paint()..color = Colors.orange,
    );
    canvas.drawCircle(
      const Offset(300, 600),
      200,
      Paint()..color = Colors.blue,
    );
    final picture = recorder.endRecording(),
        image = picture.toImageSync(600, 1200);
    picture.dispose();
    return OneFrameImageStreamCompleter(
      SynchronousFuture(ImageInfo(image: image)),
    );
  }
}

void main() {
  testWidgets(
    'reader HTML retains visible inline illustration between body paragraphs',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: SizedBox(
                width: 300,
                child: Html(
                  data: '<article><h3>插圖測試</h3><p>插圖前的正文</p><img src="https://example.test/a.jpg"><p>插圖後的正文</p></article>',
                  style: {
                    'body': Style(
                      margin: Margins.zero,
                      padding: HtmlPaddings.all(16),
                    ),
                    'img': Style(
                      width: Width(100, Unit.percent),
                      height: Height.auto(),
                    ),
                  },
                  extensions: [
                    TagExtension(
                      tagsToExtend: {'img', 'source'},
                      builder: (context) => const NovelIllustration(
                        image: FixtureImage(),
                        errorLabel: 'Error',
                        retryLabel: 'Retry',
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      expect(find.byType(RawImage), findsOneWidget);
      expect(tester.widget<RawImage>(find.byType(RawImage)).image, isNotNull);
      expect(tester.getSize(find.byType(RawImage)).width, greaterThan(0));
      expect(
        tester.getTopLeft(find.text('插圖前的正文')).dy,
        lessThan(tester.getTopLeft(find.byType(RawImage)).dy),
      );
      expect(
        tester.getTopLeft(find.text('插圖後的正文')).dy,
        greaterThan(tester.getBottomLeft(find.byType(RawImage)).dy),
      );
      expect(tester.takeException(), isNull);
    },
  );
}
