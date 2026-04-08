const statusDot  = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const dlList     = document.getElementById('dl-list');
const dlCount    = document.getElementById('dl-count');
const dlPageBtn  = document.getElementById('dl-page-btn');
const manualUrl  = document.getElementById('manual-url');
const manualSend = document.getElementById('manual-send-btn');

// ── Check PIDM status ────────────────────────────────────────────────────────
function checkPIDM() {
  chrome.runtime.sendMessage({ type: 'ping_pidm' }, (res) => {
    if (res?.running) {
      statusDot.className  = 'status-dot active';
      statusText.textContent = `PIDM running (port ${res.port})`;
      dlPageBtn.disabled = false;
    } else {
      statusDot.className  = 'status-dot offline';
      statusText.textContent = 'PIDM not running';
      dlPageBtn.disabled = true;
    }
  });
}

// ── Load detected downloads for current tab ──────────────────────────────────
function loadDownloads(tabId) {
  chrome.runtime.sendMessage({ type: 'get_downloads', tabId }, (res) => {
    const downloads = res?.downloads || [];
    dlCount.textContent = downloads.length;

    if (downloads.length === 0) {
      dlList.innerHTML = '<div class="empty-msg">No downloads detected yet</div>';
      return;
    }

    dlList.innerHTML = '';
    downloads.forEach((dl) => {
      const item = document.createElement('div');
      item.className = 'dl-item';

      const shortUrl = (() => {
        try { return new URL(dl.url).pathname.split('/').pop() || dl.url; }
        catch { return dl.url; }
      })();

      item.innerHTML = `
        <div class="dl-item-info">
          <div class="dl-item-url" title="${dl.url}">${shortUrl || dl.url}</div>
          <div class="dl-item-type">${dl.contentType || 'unknown'}</div>
        </div>
        <button class="dl-item-btn">⬇</button>
      `;

      item.querySelector('.dl-item-btn').addEventListener('click', () => {
        const btn = item.querySelector('.dl-item-btn');
        btn.textContent = '⏳';
        btn.disabled = true;

        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
          chrome.runtime.sendMessage({
            type: 'send_to_pidm',
            data: {
              url: dl.url,
              referrer: tab?.url || '',
              userAgent: navigator.userAgent,
              cookies: ''
            }
          }, (res) => {
            btn.textContent = res?.ok ? '✓' : '✗';
            setTimeout(() => {
              btn.textContent = '⬇';
              btn.disabled = false;
            }, 2000);
          });
        });
      });

      dlList.appendChild(item);
    });
  });
}

// ── Download current page ────────────────────────────────────────────────────
dlPageBtn.addEventListener('click', () => {
  dlPageBtn.textContent = '⏳ Sending...';
  dlPageBtn.disabled = true;

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.runtime.sendMessage({
      type: 'send_to_pidm',
      data: {
        url: tab.url,
        referrer: tab.url,
        userAgent: navigator.userAgent,
        cookies: ''
      }
    }, (res) => {
      if (res?.ok) {
        dlPageBtn.textContent = '✓ Sent to PIDM!';
        dlPageBtn.style.background = '#4CAF50';
      } else {
        dlPageBtn.textContent = '✗ PIDM not running';
        dlPageBtn.style.background = '#F44336';
      }
      setTimeout(() => {
        dlPageBtn.textContent = '⬇ Download This Page';
        dlPageBtn.style.background = '';
        dlPageBtn.disabled = false;
        checkPIDM();
      }, 2500);
    });
  });
});

// ── Manual URL ───────────────────────────────────────────────────────────────
manualSend.addEventListener('click', () => {
  const url = manualUrl.value.trim();
  if (!url) return;

  manualSend.textContent = '⏳';
  manualSend.disabled = true;

  chrome.runtime.sendMessage({
    type: 'send_to_pidm',
    data: { url, referrer: '', userAgent: navigator.userAgent, cookies: '' }
  }, (res) => {
    manualSend.textContent = res?.ok ? '✓' : '✗';
    setTimeout(() => {
      manualSend.textContent = 'Send';
      manualSend.disabled = false;
      if (res?.ok) manualUrl.value = '';
    }, 2000);
  });
});

manualUrl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') manualSend.click();
});

// ── Init ─────────────────────────────────────────────────────────────────────
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (tab) loadDownloads(tab.id);
});
checkPIDM();
