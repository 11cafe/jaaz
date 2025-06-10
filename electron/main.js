// electron/main.js
// npx electron electron/main.js

const fs = require('fs')
const path = require('path')
const os = require('os')

// Create or append to a log file in the user's home directory
const logPath = path.join(os.homedir(), 'jaaz-log.txt')
// Check if the log file exists and delete it
if (fs.existsSync(logPath)) {
  fs.unlinkSync(logPath)
}

const logStream = fs.createWriteStream(logPath, { flags: 'a' })

// Redirect all stdout and stderr to the log file
process.stdout.write = process.stderr.write = logStream.write.bind(logStream)

// Optional: Add timestamps to log output
const origLog = console.log
console.log = (...args) => {
  const time = new Date().toISOString()
  origLog(`[${time}]`, ...args)
}

console.error = (...args) => {
  const time = new Date().toISOString()
  origLog(`[${time}][ERROR]`, ...args)
}

// Initial log entry
console.log('🟢 Jaaz Electron app starting...')

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const { spawn } = require('child_process')

const { autoUpdater } = require('electron-updater')

const net = require('net')

function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()

    server.on(
      'error',
      /** @param {NodeJS.ErrnoException} err */ (err) => {
        if (err.code === 'EADDRINUSE') {
          // Port is in use, try the next one
          findAvailablePort(startPort + 1)
            .then(resolve)
            .catch(reject)
        } else {
          reject(err)
        }
      }
    )

    server.listen(startPort, () => {
      server.close(() => {
        resolve(startPort)
      })
    })
  })
}

let mainWindow
let pyProc = null
let pyPort = null

// check for updates after the app is ready
// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...')
})

autoUpdater.on('update-available', (info) => {
  console.log('Update available.')
  console.log('Version:', info.version)
  console.log('Release date:', info.releaseDate)
  // Automatically download the update when available
  autoUpdater.downloadUpdate()
})

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available:', info)
})

autoUpdater.on('error', (err) => {
  console.log('Error in auto-updater. ' + err)
})

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = 'Download speed: ' + progressObj.bytesPerSecond
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%'
  log_message =
    log_message + ' (' + progressObj.transferred + '/' + progressObj.total + ')'
  console.log(log_message)
})

autoUpdater.on('update-downloaded', (info) => {
  console.log('new Jaaz version downloaded:', info.version)

  // send message to renderer process
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info)
  }
})

const createWindow = (pyPort) => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, '../assets/icons/unicorn.png'), // ✅ Use .png for dev
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // for showing local image and video files
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
  })

  // In development, use Vite dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5174', {
      extraHeaders: 'pragma: no-cache\n',
    })
    mainWindow.webContents.openDevTools()
  } else {
    // In production, load built files
    mainWindow.loadURL(`http://127.0.0.1:${pyPort}`, {
      extraHeaders: 'pragma: no-cache\n',
    })
  }
}

// 获取 app.asar 内部的根路径
const appRoot = app.getAppPath()

const startPythonApi = async () => {
  // Find an available port
  pyPort = await findAvailablePort(57988)
  console.log('available pyPort:', pyPort)

  // 确定UI dist目录
  const env = {
    ...process.env,
  }
  env.PYTHONIOENCODING = 'utf-8'
  if (app.isPackaged) {
    env.UI_DIST_DIR = path.join(process.resourcesPath, 'react', 'dist')
    env.USER_DATA_DIR = app.getPath('userData')
    env.IS_PACKAGED = '1'
  }

  // Determine the Python executable path (considering packaged app)
  const isWindows = process.platform === 'win32'
  const pythonExecutable = app.isPackaged
    ? path.join(
        process.resourcesPath,
        'server',
        'dist',
        'main',
        isWindows ? 'main.exe' : 'main'
      )
    : 'python'
  console.log('Resolved Python executable:', pythonExecutable)

  const fs = require('fs')

  console.log('Exists?', fs.existsSync(pythonExecutable))

  // fs.chmodSync(pythonExecutable, "755");

  console.log('Python executable path:', pythonExecutable)
  console.log('Python executable exists?', fs.existsSync(pythonExecutable))
  console.log('env:', env)
  const scriptPath = path.join(__dirname, '../server/main.py')

  // Start the FastAPI process
  pyProc = spawn(
    pythonExecutable,
    app.isPackaged ? [`--port`, pyPort] : [scriptPath, `--port`, pyPort],
    { env: env }
  )

  // Log output to logStream (shared with console.log)
  pyProc.stdout.on('data', (data) => {
    const log = `[${new Date().toISOString()}][PYTHON stdout] ${data}`
    logStream.write(log)
    process.stdout.write(log) // optional: echo to terminal if running from CLI
  })

  pyProc.stderr.on('data', (data) => {
    const log = `[${new Date().toISOString()}][PYTHON stderr] ${data}`
    logStream.write(log)
    process.stderr.write(log) // optional: echo to terminal if running from CLI
  })

  // Optional: log if spawn fails
  pyProc.on('error', (err) => {
    const log = `[${new Date().toISOString()}][PYTHON spawn error] ${err.toString()}\n`
    logStream.write(log)
    process.stderr.write(log)
  })

  // Optional: log process exit
  pyProc.on('exit', (code, signal) => {
    const log = `[${new Date().toISOString()}][PYTHON exited] code=${code}, signal=${signal}\n`
    logStream.write(log)
  })

  return pyPort
}

// Add these handlers before app.whenReady()
ipcMain.handle('pick-image', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
    ],
  })

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths
  }
  return null
})

ipcMain.handle('pick-video', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Videos', extensions: ['mp4', 'webm', 'mov', 'avi'] }],
  })

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

// Add IPC handlers for manual update check
ipcMain.handle('check-for-updates', () => {
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify()
    return { message: 'Checking for updates...' }
  } else {
    return { message: 'Auto-updater is disabled in development mode' }
  }
})

// restart and install the new version
ipcMain.handle('restart-and-install', () => {
  autoUpdater.quitAndInstall()
})

const ipcHandlers = require('./ipcHandlers')

for (const [channel, handler] of Object.entries(ipcHandlers)) {
  ipcMain.handle(channel, handler)
}

app.whenReady().then(async () => {
  // Check for updates in production every time app starts
  if (process.env.NODE_ENV !== 'development' && app.isPackaged) {
    // Wait a bit for the app to fully load before checking updates
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify()
    }, 3000)
  }

  if (process.env.NODE_ENV !== 'development') {
    const pyPort = await startPythonApi()
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      // wait for the server to start
      let status = await fetch(`http://127.0.0.1:${pyPort}`)
        .then((res) => {
          return res.ok
        })
        .catch((err) => {
          console.error(err)
          return false
        })
      if (status) {
        break
      }
    }
  }
  createWindow(pyPort)
})

// Quit the app and clean up the Python process
app.on('will-quit', () => {
  if (pyProc) {
    pyProc.kill()
    pyProc = null
  }
})

// ipcMain.handle("reveal-in-explorer", async (event, filePath) => {
//   try {
//     // Convert relative path to absolute path
//     const fullPath = path.join(app.getPath("userData"), "workspace", filePath);

//     // Use shell.openPath which is the recommended way in Electron
//     await shell.showItemInFolder(fullPath);
//     return { success: true };
//   } catch (error) {
//     console.error("Error revealing file:", error);
//     return { error: error.message };
//   }
// });
