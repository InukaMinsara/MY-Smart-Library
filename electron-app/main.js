const { app, BrowserWindow } = require('electron')
const path = require('path')

// Force single instance to handle deep links properly
const gotTheLock = app.requestSingleInstanceLock()
let mainWindow = null;

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
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    title: "Smart Library Pro",
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.loadURL('https://smartlibrary02.netlify.app/')
}

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
