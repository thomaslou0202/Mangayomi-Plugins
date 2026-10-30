import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mangayomi/main.dart';
import 'package:mangayomi/models/chapter.dart';
import 'package:mangayomi/models/download.dart';
import 'package:mangayomi/services/database_worker.dart';
import 'package:mangayomi/services/library_chapter_summary.dart';

final librarySummaryProvider = StreamProvider<Map<int, LibraryChapterSummary>>((
  ref,
) {
  final controller = StreamController<Map<int, LibraryChapterSummary>>();
  Timer? debounce;
  bool running = false, dirty = false, disposed = false;
  Future<void> refresh() async {
    if (running) {
      dirty = true;
      return;
    }
    running = true;
    try {
      do {
        dirty = false;
        final result = await DatabaseWorker.instance
            .run<Map<int, LibraryChapterSummary>>('summary');
        if (!disposed) controller.add(result);
      } while (dirty && !disposed);
    } catch (error, stack) {
      if (!disposed) controller.addError(error, stack);
    } finally {
      running = false;
    }
  }

  void changed() {
    debounce?.cancel();
    debounce = Timer(const Duration(milliseconds: 250), refresh);
  }

  final chapters = isar.chapters.watchLazy().listen((_) => changed());
  final downloads = isar.downloads.watchLazy().listen((_) => changed());
  ref.onDispose(() {
    disposed = true;
    debounce?.cancel();
    chapters.cancel();
    downloads.cancel();
    controller.close();
  });
  unawaited(refresh());
  return controller.stream;
});

LibraryChapterSummary summaryFor(
  Map<int, LibraryChapterSummary>? rows,
  int? id,
) => rows?[id] ?? const LibraryChapterSummary();
