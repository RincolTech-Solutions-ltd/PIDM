const PIDM_PORTS = Array.from({ length: 10 }, (_, i) => 49152 + i);
let pidmPort = null;

// ── Downloadable MIME types and extensions ──────────────────────────────────
const MEDIA_MIME_PREFIXES = ['video/', 'audio/'];
const DL_EXTENSIONS = [
  '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.mpeg', '.mpg', '.3gp', '.ts',
  '.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a', '.alac',
  '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.iso',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.exe', '.msi', '.dmg', '.apk', '.deb', '.rpm'
];

const STREAM_SITES = [
  'youtube.com', 'youtu.be',
  'vimeo.com', 'dailymotion.com',
  'twitch.tv', 'facebook.com',
  'twitter.com', 'x.com',
  'instagram.com', 'tiktok.com',
  'soundcloud.com'
];

function isDownloadableUrl(url) {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return DL_EXTENSIONS.some(ext => path.endsWith(ext));
  } catch { return false; }
}

function isMediaMime(contentType) {
  return MEDIA_MIME_PREFIXES.some(p => contentType.startsWith(p));
}

function isStreamSite(url) {
  try {
    const host = new URL(url).hostname.replace('www.', '');
    return STREAM_SITES.some(s => host === s || host.endsWith('.' + s));
  } catch { return false; }
}

// ── Find PIDM port ───────────────────────────────────────────────────────────
async function findPIDMPort() {
  for (const port of PIDM_PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/ping`, {
        signal: AbortSignal.timeout(1000)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'pidm_active') {
          pidmPort = port;
          return port;
        }
      }
    } catch { /* try next */ }
  }
  pidmPort = null;
  return null;
}

async function getPIDMPort() {
  if (pidmPort) {
    // quick verify it's still alive
    try {
      const res = await fetch(`http://127.0.0.1:${pidmPort}/api/ping`, {
        signal: AbortSignal.timeout(800)
      });
      if (res.ok) return pidmPort;
    } catch { /* fall through */ }
  }
  return await findPIDMPort();
}

// ── Send URL to PIDM ─────────────────────────────────────────────────────────
async function sendToPIDM(downloadInfo) {
  const port = await getPIDMPort();
  if (!port) return false;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(downloadInfo)
    });
    return res.ok;
  } catch { return false; }
}

// ── Track intercepted downloads per tab ─────────────────────────────────────
async function getTabDownloads(tabId) {
  const key = `tab_${tabId}`;
  const result = await chrome.storage.session.get(key);
  return result[key] || [];
}

async function addTabDownload(tabId, item) {
  const downloads = await getTabDownloads(tabId);
  if (!downloads.find(d => d.url === item.url)) {
    downloads.push(item);
    await chrome.storage.session.set({ [`tab_${tabId}`]: downloads });
    chrome.action.setBadgeText({ text: String(downloads.length), tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#e94560', tabId });
  }
}

async function clearTabDownloads(tabId) {
  await chrome.storage.session.remove(`tab_${tabId}`);
  chrome.action.setBadgeText({ text: '', tabId });
}

// ── Web request interception ─────────────────────────────────────────────────
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (!details.tabId || details.tabId < 0) return;

    const contentType = (details.responseHeaders?.find(
      h => h.name.toLowerCase() === 'content-type'
    )?.value || '').toLowerCase().split(';')[0].trim();

    const contentDisp = details.responseHeaders?.find(
      h => h.name.toLowerCase() === 'content-disposition'
    )?.value || '';

    const isMedia = isMediaMime(contentType);
    const isAttachment = contentDisp.includes('attachment');
    const isDlUrl = isDownloadableUrl(details.url);

    if (isMedia || isAttachment || isDlUrl) {
      // Skip tiny requests (likely thumbnails/icons)
      const contentLength = parseInt(
        details.responseHeaders?.find(h => h.name.toLowerCase() === 'content-length')?.value || '0'
      );
      if (contentLength > 0 && contentLength < 100_000) return; // < 100KB, skip

      addTabDownload(details.tabId, {
        url: details.url,
        contentType,
        filename: contentDisp.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)?.[1]?.replace(/['"]/g, '') || '',
        timestamp: Date.now()
      });
    }
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// ── Clear on navigation ──────────────────────────────────────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') clearTabDownloads(tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  clearTabDownloads(tabId);
});

// ── Message handler ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ping_pidm') {
    getPIDMPort().then(port => sendResponse({ running: !!port, port }));
    return true;
  }

  if (message.type === 'get_downloads') {
    getTabDownloads(message.tabId).then(downloads => sendResponse({ downloads }));
    return true;
  }

  if (message.type === 'send_to_pidm') {
    sendToPIDM(message.data).then(ok => sendResponse({ ok }));
    return true;
  }

  if (message.type === 'download_stream_page') {
    chrome.tabs.get(message.tabId, (tab) => {
      sendToPIDM({
        url: tab.url,
        referrer: tab.url,
        userAgent: navigator.userAgent,
        cookies: message.cookies || ''
      }).then(ok => sendResponse({ ok }));
    });
    return true;
  }
});
