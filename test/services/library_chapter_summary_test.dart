import 'package:flutter_test/flutter_test.dart';
import 'package:mangayomi/services/library_chapter_summary.dart';

void main() {
  test('counts, hidden scanlators, nullable flags and numeric dates', () {
    final builder = LibrarySummaryBuilder();
    void add(int? mangaId, bool read, String? scanlator, String date) =>
        builder.add(
          mangaId: mangaId,
          read: read,
          scanlator: scanlator,
          dateUpload: date,
          downloaded: true,
          bookmarked: !read,
        );
    add(7, false, 'A', '9');
    add(7, false, 'B', '10');
    add(7, true, 'A', '2');
    add(7, false, null, '');
    add(null, false, '', '999');
    final result = builder.finish();
    expect(result.keys, [7]);
    expect(result[7]!.total, 4);
    expect(result[7]!.unread, 3);
    expect(result[7]!.bookmarked, 3);
    expect(result[7]!.downloaded, 4);
    expect(result[7]!.visibleUnread(['A', 'A', 'missing']), 2);
    expect(result[7]!.visibleUnread(['A', 'B']), 1);
    expect(result[7]!.latestUpload, '10');
  });

  test('65000 chapters agree with independently counted library rows', () {
    final builder = LibrarySummaryBuilder();
    final expected = <int, List<int>>{};
    for (var i = 0; i < 65000; i++) {
      final manga = i % 1473;
      final read = i % 3 == 0;
      final bookmarked = i % 7 == 0;
      final downloaded = i % 11 == 0;
      final scanlator = i % 2 == 0 ? 'hidden' : 'visible';
      builder.add(
        mangaId: manga,
        read: read,
        bookmarked: bookmarked,
        downloaded: downloaded,
        scanlator: scanlator,
        dateUpload: '$i',
      );
      final counts = expected.putIfAbsent(manga, () => [0, 0, 0, 0, 0]);
      counts[0]++;
      if (!read) counts[1]++;
      if (bookmarked) counts[2]++;
      if (downloaded) counts[3]++;
      if (!read && scanlator == 'visible') counts[4]++;
    }
    final summaries = builder.finish();
    expect(summaries.length, 1473);
    for (final entry in expected.entries) {
      final summary = summaries[entry.key]!;
      expect([
        summary.total,
        summary.unread,
        summary.bookmarked,
        summary.downloaded,
        summary.visibleUnread(['hidden']),
      ], entry.value);
    }
  });
}
