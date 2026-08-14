const { ipcRenderer } = require('electron');

// Listen for network status changes in the renderer process
window.addEventListener('online', () => {
  ipcRenderer.send('network-status', 'online');
});

window.addEventListener('offline', () => {
  ipcRenderer.send('network-status', 'offline');
});
