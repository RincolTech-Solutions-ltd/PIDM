# PIDM Browser Extension

Works on **Chrome**, **Edge**, and **Firefox** (Manifest V3).

## Install (Developer Mode)

### Chrome / Edge
1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this `browser-extension` folder

### Firefox
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select the `manifest.json` file inside this folder

## Features
- **Auto-detect** video, audio, and file downloads on any page
- **Floating download bar** on YouTube, Vimeo, Twitch, and other video sites
- **YouTube button** injected directly next to video controls
- **Intercept direct links** (.mp4, .zip, .pdf, etc.) and redirect to PIDM
- **Manual URL** input in the popup
- Requires PIDM to be running locally
