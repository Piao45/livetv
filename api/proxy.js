// api/proxy.js — HLS proxy for the live TV site.
//
// Why this exists: the site is served over https, but the free CCTV stream
// sources are plain http://, and browsers refuse to load http:// media from
// an https:// page (mixed content). This function fetches the upstream URL
// server-side and re-serves it over https.
//
// - HLS manifests (.m3u8): fetched as text, every segment/key/variant URI
//   inside is rewritten to an absolute URL that also goes through this
//   proxy, so playback stays on https end to end. Redirects are followed
//   server-side and the FINAL url is used as the base for resolving
//   relative segment paths (upstream hosts 302 to signed hosts).
// - Media segments (.ts etc.): streamed through as bytes, no buffering.
// - No auth, no login. All video data flows through Vercel (Hobby plan,
//   100 GB/month) — fine for one person's CCTV viewing.
//
// Vercel Node runtime: CommonJS (no package.json "type": "module"), global
// fetch is available (Node 18+).
'use strict';

var stream = require('stream');

var UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function proxyUrl(req, target) {
  var proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  var host = req.headers['x-forwarded-host'] || req.headers.host || '';
  return proto + '://' + host + '/api/proxy?url=' + encodeURIComponent(target);
}

// Rewrite every URI inside an HLS manifest so it goes through this proxy.
// Lines starting with '#' may carry URI="..." attributes (EXT-X-KEY,
// EXT-X-MAP, EXT-X-MEDIA, ...); all other non-empty lines are segment or
// variant-playlist URIs (relative or absolute). baseUrl is the FINAL url
// after following redirects.
function rewriteManifest(text, baseUrl, req) {
  var lines = text.split(/\r?\n/);
  var out = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) { out.push(''); continue; }
    if (line.charAt(0) === '#') {
      out.push(line.replace(/URI="([^"]+)"/g, function (m, uri) {
        try {
          return 'URI="' + proxyUrl(req, new URL(uri, baseUrl).toString()) + '"';
        } catch (e) { return m; }
      }));
    } else {
      try {
        out.push(proxyUrl(req, new URL(line, baseUrl).toString()));
      } catch (e) {
        out.push(line);
      }
    }
  }
  return out.join('\n');
}

function contentTypeFor(url, upstreamType) {
  if (upstreamType) return upstreamType;
  if (/\.m3u8(\?|$)/i.test(url)) return 'application/vnd.apple.mpegurl';
  if (/\.ts(\?|$)/i.test(url)) return 'video/MP2T';
  if (/\.key(\?|$)/i.test(url)) return 'application/octet-stream';
  return 'application/octet-stream';
}

module.exports = async function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  var target = req.query && req.query.url;
  if (!target || typeof target !== 'string') {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('missing ?url= parameter');
    return;
  }

  var targetUrl;
  try {
    targetUrl = new URL(target);
    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
      throw new Error('bad protocol');
    }
  } catch (e) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('invalid url');
    return;
  }

  var method = req.method === 'HEAD' ? 'HEAD' : 'GET';
  var headers = { 'User-Agent': UA, 'Accept': '*/*' };
  if (req.headers.range) headers['Range'] = req.headers.range;

  var upstream;
  try {
    upstream = await fetch(targetUrl.toString(), {
      method: method,
      headers: headers,
      redirect: 'follow',
    });
  } catch (e) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('upstream fetch failed: ' + (e && e.message ? e.message : e));
    return;
  }

  var finalUrl = upstream.url || targetUrl.toString();
  var upstreamType = upstream.headers.get('content-type') || '';
  var looksManifest = /mpegurl/i.test(upstreamType) || /\.m3u8(\?|$)/i.test(finalUrl);

  if (method === 'GET' && looksManifest) {
    var text = await upstream.text();
    // Strip BOM for the check; keep the original text for rewriting.
    var trimmed = text.replace(/^\uFEFF/, '').trim();
    if (trimmed.indexOf('#EXTM3U') === 0) {
      var rewritten = rewriteManifest(text, finalUrl, req);
      res.statusCode = upstream.status;
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-store');
      res.end(rewritten);
      return;
    }
    // Not actually a manifest (e.g. an error page at a .m3u8 URL):
    // serve the body as-is instead of dropping it.
    res.statusCode = upstream.status;
    res.setHeader('Content-Type', contentTypeFor(finalUrl, upstreamType));
    res.setHeader('Cache-Control', 'no-store');
    res.end(text);
    return;
  }

  // Binary passthrough (media segments, keys, ...): stream bytes, do not
  // buffer the whole file in memory.
  res.statusCode = upstream.status;
  res.setHeader('Content-Type', contentTypeFor(finalUrl, upstreamType));
  var len = upstream.headers.get('content-length');
  if (len) res.setHeader('Content-Length', len);
  var range = upstream.headers.get('content-range');
  if (range) res.setHeader('Content-Range', range);
  var acceptRanges = upstream.headers.get('accept-ranges');
  if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
  res.setHeader('Cache-Control', 'public, max-age=60');

  if (method === 'HEAD' || !upstream.body) {
    res.end();
    return;
  }
  try {
    stream.Readable.fromWeb(upstream.body).pipe(res);
  } catch (e) {
    // Fallback: buffer (small segments only in practice).
    var buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
  }
};
