import 'dart:convert';

/// Resolve only normal website links; local archives never have web comments.
String? resolveCommentsPageUrl({
  required String? link,
  String? baseUrl,
  bool isLocalArchive = false,
}) {
  if (isLocalArchive || link == null || link.trim().isEmpty) return null;
  final relative = Uri.tryParse(link.trim());
  if (relative == null) return null;
  Uri? target;
  if (relative.hasScheme) {
    target = relative;
  } else {
    final base = Uri.tryParse(baseUrl?.trim() ?? '');
    if (base == null ||
        !['http', 'https'].contains(base.scheme) ||
        base.host.isEmpty) {
      return null;
    }
    target = base.resolveUri(relative);
  }
  if (!['http', 'https'].contains(target.scheme) ||
      target.host.isEmpty ||
      target.userInfo.isNotEmpty) {
    return null;
  }
  return target.toString();
}

/// A read-only DOM locator: no requests, form input or clicks on the website.
/// It waits briefly for lazy comment widgets, and stops when the reader scrolls.
String commentsFocusScript(String pageUrl) => _commentsFocusTemplate
    .replaceFirst('__MANGAYOMI_PAGE_URL__', jsonEncode(pageUrl));

const _commentsFocusTemplate = r'''
(() => {
  if (window.top !== window) return;
  const expected = new URL(__MANGAYOMI_PAGE_URL__);
  const current = new URL(window.location.href);
  const path = url => url.pathname.replace(/\/+$/, '') || '/';
  if (current.host !== expected.host || path(current) !== path(expected) ||
      current.search !== expected.search) return;
  if (window.__mangayomiCommentsLocator) return;
  window.__mangayomiCommentsLocator = true;
  const start = () => {
    let timer, deadline, observer, stopped = false, lastTarget;
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    const stop = () => {
      stopped = true;
      clearTimeout(timer); clearTimeout(deadline);
      if (observer) observer.disconnect();
      events.forEach(event => window.removeEventListener(event, stop, true));
      window.removeEventListener('pagehide', stop);
    };
    const selectors = [
      '#Comment', '#comments', '#comment', '#comment-list', '#commentList',
      '#comment_list', '#comments-list', '#commentlist', '#commentArea',
      '#comment-area', '#comment-section', '#comments-section', '#disqus_thread',
      '#SOHUCS', '#reviews', '#review-list', '.comment-list', '.comments-list',
      '.comment-section', '.comments-section', '.review-list',
      'section.comments', 'div.comments', 'div.comment',
      'iframe[src*="disqus"]', 'iframe[src*="comment"]'
    ];
    const visible = element => element && element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== 'hidden';
    const title = /^(?:(?:全部|熱門|热门|最新|讀者|读者|作品)\s*)?(?:評論|评论|留言|書評|书评|吐槽|comments?|reviews?)(?:\s*[（(]?\s*\d[^\n]*)?$/i;
    const find = () => {
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (visible(element)) return element;
      }
      for (const heading of document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"],legend')) {
        if (visible(heading) && title.test(heading.textContent.trim())) return heading;
      }
      for (const link of document.querySelectorAll('a[href^="#"]')) {
        if (!title.test(link.textContent.trim())) continue;
        try {
          const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
          if (visible(target)) return target;
        } catch (_) {}
      }
      return null;
    };
    const locate = () => {
      if (stopped) return;
      const target = find();
      if (!target) return;
      const ready = target.childElementCount > 0 || target.textContent.trim().length > 0 ||
        target.tagName === 'IFRAME';
      if (target !== lastTarget || ready) {
        target.scrollIntoView({block: 'start', behavior: 'auto'});
        lastTarget = target;
      }
      if (ready) stop();
    };
    const schedule = () => {
      if (stopped || timer) return;
      timer = setTimeout(() => { timer = null; locate(); }, 250);
    };
    events.forEach(event => window.addEventListener(event, stop, {capture: true, passive: true}));
    window.addEventListener('pagehide', stop, {once: true});
    observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {childList: true, subtree: true,
      attributes: true, attributeFilter: ['class', 'style', 'hidden']});
    deadline = setTimeout(stop, 20000);
    locate();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})();
''';
