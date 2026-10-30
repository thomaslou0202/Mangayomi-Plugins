import 'dart:io';

import 'package:mangayomi/modules/webview/comments.dart';

/// Exports the actual app script for DOM tests in the release pipeline.
void main(List<String> arguments) {
  File(arguments.single)
      .writeAsStringSync(commentsFocusScript('https://example.com/book/12'));
}
