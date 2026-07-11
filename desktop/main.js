// Monitorix desktop shell: serves the static Expo web export (dist/) on a
// local-only HTTP port and opens it in a BrowserWindow. A real HTTP origin
// (rather than file://) keeps absolute asset paths, history-API routing,
// and localStorage/Supabase auth working exactly as on the web.
const { app, BrowserWindow } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Packaged builds carry dist/ in resources (see extraResources in
// package.json); in development it's the repo-root export.
const DIST_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'dist')
  : path.join(__dirname, '..', 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.wasm': 'application/wasm',
};

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let filePath = path.normalize(path.join(DIST_DIR, urlPath));

      // Never serve anything outside dist (the path.sep suffix also blocks
      // sibling directories like "dist-evil"), and fall back to index.html
      // for routes (single-page app behavior).
      if (filePath !== DIST_DIR && !filePath.startsWith(DIST_DIR + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        const indexInDir = path.join(filePath, 'index.html');
        filePath = fs.existsSync(indexInDir) ? indexInDir : path.join(DIST_DIR, 'index.html');
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
        });
        res.end(data);
      });
    });

    server.once('error', reject);
    // Port 0 = any free port, bound to loopback only.
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

async function createWindow() {
  const port = await startServer();

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Monitorix',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'assets', 'images', 'icon.png'),
    webPreferences: {
      // The renderer only shows a web page; it never needs Node. Keep the
      // isolation defaults explicit so a bug in the page can't reach the OS.
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  await win.loadURL(`http://127.0.0.1:${port}/`);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
