const { app, BrowserWindow, ipcMain, Notification } = require('electron')
const path = require('path')

// Force single instance to handle deep links properly
const gotTheLock = app.requestSingleInstanceLock()
let mainWindow = null;
let splashWindow = null;

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      
      // Handle the deep link from commandLine arguments (Windows/Linux)
      const url = commandLine.find(arg => arg.startsWith('smartlibrary://'))
      if (url) {
        handleDeepLink(url)
      }
    }
  })
}

// Register custom protocol
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('smartlibrary', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('smartlibrary')
}

function handleDeepLink(url) {
  // Convert smartlibrary://... to https://smartlibrary02.netlify.app/...
  const targetUrl = url.replace('smartlibrary://', 'https://smartlibrary02.netlify.app/');
  if (mainWindow) {
    mainWindow.loadURL(targetUrl);
  }
}

function createWindow () {
  // 1. Create Splash Screen
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  splashWindow.loadFile('splash.html')

  // 2. Create Main Window (Hidden initially)
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Don't show until ready
    autoHideMenuBar: true,
    title: "Smart Library Pro",
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // When main window is fully loaded and ready to be shown
  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
    }
    mainWindow.show();
  });

  // 3. Handle specific network errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (validatedURL.startsWith('https://smartlibrary02.netlify.app')) {
      if (errorCode === -106 || errorCode === -105) {
        // -106 = ERR_INTERNET_DISCONNECTED
        // -105 = ERR_NAME_NOT_RESOLVED (can happen if offline)
        mainWindow.loadFile(path.join(__dirname, 'offline.html'))
      } else {
        // Fallback for other errors (like connection refused)
        mainWindow.loadFile(path.join(__dirname, 'offline.html'))
      }
    }
  })

  // 4. Handle HTTP server errors (404, 500, etc.)
  mainWindow.webContents.on('did-navigate', (event, url, httpResponseCode, httpStatusText) => {
    if (url.startsWith('https://smartlibrary02.netlify.app')) {
      if (httpResponseCode === 404) {
        mainWindow.loadFile(path.join(__dirname, 'deleted.html'))
      } else if (httpResponseCode >= 500) {
        mainWindow.loadFile(path.join(__dirname, 'maintenance.html'))
      }
    }
  })

  // Load the main site
  mainWindow.loadURL('https://smartlibrary02.netlify.app/')
}

// Listen for network status from preload.js
ipcMain.on('network-status', (event, status) => {
  if (status === 'offline') {
    new Notification({ title: 'Smart Library Pro', body: 'Internet Connection Lost.' }).show()
  } else if (status === 'online') {
    new Notification({ title: 'Smart Library Pro', body: 'Internet Restored. Back Online!' }).show()
    
    // If the user is currently stuck on the offline error page, auto-refresh!
    if (mainWindow) {
      const currentUrl = mainWindow.webContents.getURL();
      if (currentUrl.includes('offline.html')) {
        mainWindow.loadURL('https://smartlibrary02.netlify.app/');
      }
    }
  }
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Handle macOS deep linking
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleDeepLink(url)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
