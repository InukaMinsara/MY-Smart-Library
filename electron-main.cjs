const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow;
let serverProcess;

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: "Smart Library",
    autoHideMenuBar: true,
  });

  mainWindow.maximize();

  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

function startNitroServer() {
  const serverPath = path.join(__dirname, '.output', 'server', 'index.mjs');
  
  // Use Electron runtime when packaged, or node binary in dev mode
  const nodeBin = app.isPackaged ? process.execPath : 'node';
  const nodeEnv = app.isPackaged
    ? { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: 0 }
    : { ...process.env, PORT: 0 };

  serverProcess = spawn(nodeBin, [serverPath], {
    env: nodeEnv,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`Server: ${output}`);
    
    // Nitro typically logs "Listening on http://[::]:12345" or "http://localhost:12345"
    const match = output.match(/Listening on http:\/\/[a-zA-Z0-9\[\]\.\-:]+:(\d+)/);
    if (match && match[1]) {
      const port = parseInt(match[1], 10);
      console.log(`Detected Nitro server running on port: ${port}`);
      if (!mainWindow) {
        createWindow(port);
      }
    }
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server Error: ${data.toString()}`);
  });

  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
  });
}

app.on('ready', () => {
  startNitroServer();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
