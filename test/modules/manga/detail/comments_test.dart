import 'package:flutter_test/flutter_test.dart';
import 'package:mangayomi/modules/webview/comments.dart';

void main() {
  test('absolute website URL retains its query and fragment', () {
    expect(
      resolveCommentsPageUrl(
        link: 'https://example.com/book?id=12#reviews',
        baseUrl: 'https://mirror.example/',
      ),
      'https://example.com/book?id=12#reviews',
    );
  });
  test('relative source links resolve against their base URL', () {
    expect(
      resolveCommentsPageUrl(
        link: '/comic/12/',
        baseUrl: 'https://example.com',
      ),
      'https://example.com/comic/12/',
    );
    expect(
      resolveCommentsPageUrl(
        link: 'book/12',
        baseUrl: 'https://example.com/catalog/',
      ),
      'https://example.com/catalog/book/12',
    );
    expect(
      resolveCommentsPageUrl(
        link: '//example.com/book/12',
        baseUrl: 'https://mirror.example/',
      ),
      'https://example.com/book/12',
    );
  });
  test('local books do not have a website comment action', () {
    expect(
      resolveCommentsPageUrl(
        link: 'https://example.com/comic/12',
        isLocalArchive: true,
      ),
      isNull,
    );
  });
  test('missing source URLs and local links cannot open a website', () {
    for (final link in [null, '', ' ', '/comic/12', 'relative']) {
      expect(resolveCommentsPageUrl(link: link), isNull);
    }
    expect(
      resolveCommentsPageUrl(link: '/comic/12', baseUrl: 'not a URL'),
      isNull,
    );
  });
  test('non-web URLs and embedded credentials are rejected', () {
    for (final link in [
      'javascript:alert(1)',
      'file:///book.cbz',
      'data:text/html,hello',
      'ftp://example.com/file',
      'https://user:password@example.com/book',
    ]) {
      expect(resolveCommentsPageUrl(link: link), isNull);
    }
  });
  test('page URLs are escaped when inserted into the script', () {
    final script = commentsFocusScript(
      'https://example.com/book?title="quoted"',
    );
    expect(
      script,
      contains(r'new URL("https://example.com/book?title=\"quoted\"")'),
    );
    expect(script, isNot(contains('__MANGAYOMI_PAGE_URL__')));
    expect(script, contains("'#Comment'"));
  });
}
