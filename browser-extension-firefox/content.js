(() => {
  'use strict';

  const STREAM_HOSTS = [
    'youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com',
    'twitch.tv', 'facebook.com', 'twitter.com', 'x.com',
    'instagram.com', 'tiktok.com', 'soundcloud.com'
  ];

  function isStreamSite() {
    const host = location.hostname.replace('www.', '');
    return STREAM_HOSTS.some(s => host === s || host.endsWith('.' + s));
  }

  function isYouTube() {
    return location.hostname.includes('youtube.com') || location.hostname.includes('youtu.be');
  }

  function getPageCookies() {
    return document.cookie;
  }

  // ── Floating download bar ──────────────────────────────────────────────────
  function createDownloadBar() {
    if (document.getElementById('pidm-bar')) return;
    if (!isStreamSite()) return;

    const bar = document.createElement('div');
    bar.id = 'pidm-bar';
    bar.innerHTML = `
      <style>
        #pidm-bar {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 2147483647;
          display: flex;
          align-items: center;
          gap: 8px;
          background: #16213e;
          border: 1px solid #0f3460;
          border-radius: 10px;
          padding: 8px 14px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 13px;
          color: #e0e0e0;
          cursor: default;
          transition: opacity 0.2s;
          user-select: none;
        }
        #pidm-bar:hover { opacity: 1 !important; }
        #pidm-bar .pidm-logo {
          width: 20px; height: 20px;
          background: #e94560;
          border-radius: 4px;
          display: flex; align-items: center; justify-content: center;
          font-weight: bold; font-size: 10px; color: white;
          flex-shrink: 0;
        }
        #pidm-bar .pidm-btn {
          background: #e94560;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 5px 12px;
          cursor: pointer;
          font-size: 12px;
          font-weight: bold;
          white-space: nowrap;
        }
        #pidm-bar .pidm-btn:hover { background: #c73652; }
        #pidm-bar .pidm-close {
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          padding: 0 2px;
        }
        #pidm-bar .pidm-close:hover { color: #fff; }
        #pidm-bar .pidm-status {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #888;
          flex-shrink: 0;
        }
        #pidm-bar .pidm-status.active { background: #4CAF50; }
      </style>
      <div class="pidm-logo">P</div>
      <span class="pidm-status" id="pidm-status-dot"></span>
      <span id="pidm-bar-label">Download with PIDM</span>
      <button class="pidm-btn" id="pidm-dl-btn">⬇ Download</button>
      <button class="pidm-close" id="pidm-close-btn">✕</button>
    `;

    document.body.appendChild(bar);

    // Ping PIDM
    chrome.runtime.sendMessage({ type: 'ping_pidm' }, (res) => {
      const dot = document.getElementById('pidm-status-dot');
      if (dot) dot.className = 'pidm-status' + (res?.running ? ' active' : '');
    });

    document.getElementById('pidm-dl-btn').addEventListener('click', () => {
      const btn = document.getElementById('pidm-dl-btn');
      btn.textContent = '⏳ Sending...';
      btn.disabled = true;

      chrome.runtime.sendMessage({
        type: 'send_to_pidm',
        data: {
          url: location.href,
          referrer: document.referrer || location.href,
          userAgent: navigator.userAgent,
          cookies: getPageCookies()
        }
      }, (res) => {
        if (res?.ok) {
          btn.textContent = '✓ Sent!';
          btn.style.background = '#4CAF50';
          setTimeout(() => {
            btn.textContent = '⬇ Download';
            btn.style.background = '';
            btn.disabled = false;
          }, 2000);
        } else {
          btn.textContent = '✗ PIDM not running';
          btn.style.background = '#F44336';
          setTimeout(() => {
            btn.textContent = '⬇ Download';
            btn.style.background = '';
            btn.disabled = false;
          }, 2500);
        }
      });
    });

    document.getElementById('pidm-close-btn').addEventListener('click', () => {
      bar.remove();
    });

    // Auto-fade after 5s
    setTimeout(() => { if (bar.isConnected) bar.style.opacity = '0.4'; }, 5000);
  }

  // ── YouTube: inject Download button next to Subscribe ────────────────────
  function injectYouTubeButton() {
    if (!isYouTube()) return;
    if (!location.pathname.startsWith('/watch')) return;
    if (document.getElementById('pidm-yt-btn')) return;

    const actionsRow = document.querySelector(
      'ytd-watch-metadata #actions, #actions-inner #menu, ytd-menu-renderer, #top-level-buttons-computed'
    );
    if (!actionsRow) return;

    const btn = document.createElement('button');
    btn.id = 'pidm-yt-btn';
    btn.innerHTML = `
      <style>
        #pidm-yt-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #e94560;
          color: white;
          border: none;
          border-radius: 18px;
          padding: 0 16px;
          height: 36px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          margin-left: 8px;
          font-family: 'Roboto', Arial, sans-serif;
          vertical-align: middle;
        }
        #pidm-yt-btn:hover { background: #c73652; }
        #pidm-yt-btn svg { width: 16px; height: 16px; fill: white; }
      </style>
      <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zm-8 2V5h2v6h1.17L12 13.17 9.83 11H11zm-6 7h14v2H5z"/></svg>
      Download
    `;

    btn.addEventListener('click', () => {
      btn.innerHTML = btn.innerHTML.replace('Download', 'Sending...');
      chrome.runtime.sendMessage({
        type: 'send_to_pidm',
        data: {
          url: location.href,
          referrer: location.href,
          userAgent: navigator.userAgent,
          cookies: getPageCookies()
        }
      }, (res) => {
        if (res?.ok) {
          btn.innerHTML = btn.innerHTML.replace('Sending...', '✓ Sent to PIDM!');
          setTimeout(() => { btn.innerHTML = btn.innerHTML.replace('✓ Sent to PIDM!', 'Download'); }, 2500);
        } else {
          btn.innerHTML = btn.innerHTML.replace('Sending...', '✗ PIDM not running');
          setTimeout(() => { btn.innerHTML = btn.innerHTML.replace('✗ PIDM not running', 'Download'); }, 2500);
        }
      });
    });

    actionsRow.appendChild(btn);
  }

  // ── Intercept <a> clicks for direct file links ────────────────────────────
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;

    const href = link.href;
    const ext = href.split('?')[0].toLowerCase().split('.').pop();
    const dlExts = ['mp4','mkv','avi','mov','wmv','flv','webm','mp3','wav','flac',
                    'zip','rar','7z','tar','gz','iso','pdf','exe','msi','apk'];

    if (dlExts.includes(ext)) {
      e.preventDefault();
      e.stopPropagation();

      chrome.runtime.sendMessage({
        type: 'send_to_pidm',
        data: {
          url: href,
          referrer: location.href,
          userAgent: navigator.userAgent,
          cookies: getPageCookies()
        }
      }, (res) => {
        if (!res?.ok) {
          // PIDM not running, let the browser handle it
          window.location.href = href;
        }
      });
    }
  }, true);

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    createDownloadBar();
    if (isYouTube()) {
      // YouTube is SPA, watch for navigation
      const observer = new MutationObserver(() => {
        injectYouTubeButton();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      injectYouTubeButton();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
