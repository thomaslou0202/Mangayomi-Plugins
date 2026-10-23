// Mangayomi v0.9.9+127:
// lib/utils/extensions/others.dart UChapDataPreload.getImageProvider spreads
// PageUrl.headers first, then headersProvider's per-source headers.
// download_provider.dart adds PageUrl.headers after per-source headers.
function readerHeaders(page, sourceHeaders) { return {...(page.headers||{}), ...sourceHeaders}; }
function downloadHeaders(page, sourceHeaders) { return {...sourceHeaders, ...(page.headers||{})}; }
module.exports={readerHeaders,downloadHeaders};
