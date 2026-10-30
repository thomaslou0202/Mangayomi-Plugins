/// Small, immutable library view data. No lazy database links reach the UI.
class LibraryChapterSummary {
  final int total;
  final int unread;
  final int bookmarked;
  final int downloaded;
  final String latestUpload;
  final Map<String?, int> unreadByScanlator;

  const LibraryChapterSummary({
    this.total = 0,
    this.unread = 0,
    this.bookmarked = 0,
    this.downloaded = 0,
    this.latestUpload = '',
    this.unreadByScanlator = const {},
  });

  int visibleUnread(Iterable<String>? hiddenScanlators) {
    if (hiddenScanlators == null) return unread;
    return unread -
        hiddenScanlators.toSet().fold<int>(
          0,
          (count, name) => count + (unreadByScanlator[name] ?? 0),
        );
  }
}

/// Built once in the database isolate, reused across categories and tiles.
class LibrarySummaryBuilder {
  final _rows = <int, _MutableSummary>{};

  void add({
    required int? mangaId,
    required bool read,
    required bool bookmarked,
    required bool downloaded,
    required String? scanlator,
    required String? dateUpload,
  }) {
    if (mangaId == null) return;
    final row = _rows.putIfAbsent(mangaId, _MutableSummary.new);
    row.total++;
    if (!read) {
      row.unread++;
      row.scanlators.update(scanlator, (count) => count + 1, ifAbsent: () => 1);
    }
    if (bookmarked) row.bookmarked++;
    if (downloaded) row.downloaded++;
    // Dates are numeric epoch strings on some sources and ISO strings on others.
    final date = dateUpload ?? '';
    final a = int.tryParse(date);
    final b = int.tryParse(row.latestUpload);
    if (a != null && b != null ? a > b : date.compareTo(row.latestUpload) > 0) {
      row.latestUpload = date;
    }
  }

  Map<int, LibraryChapterSummary> finish() => {
    for (final entry in _rows.entries)
      entry.key: LibraryChapterSummary(
        total: entry.value.total,
        unread: entry.value.unread,
        bookmarked: entry.value.bookmarked,
        downloaded: entry.value.downloaded,
        latestUpload: entry.value.latestUpload,
        unreadByScanlator: Map.unmodifiable(entry.value.scanlators),
      ),
  };
}

class _MutableSummary {
  int total = 0, unread = 0, bookmarked = 0, downloaded = 0;
  String latestUpload = '';
  final scanlators = <String?, int>{};
}
