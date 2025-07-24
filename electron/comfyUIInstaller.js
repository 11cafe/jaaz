// comfyUIInstaller.js - ComfyUI安装器
const path = require('path')
const fs = require('fs')
const https = require('https')
const { spawn } = require('child_process')
const { createWriteStream } = require('fs')
const _7z = require('7zip-min')
const got = require('got')
const { pipeline } = require('stream/promises')
const crypto = require('crypto')

// Check if running in worker process
const isWorkerProcess =
  process.send !== undefined || process.env.IS_WORKER_PROCESS === 'true'

// Import electron modules only if not in worker process
let app, BrowserWindow
if (!isWorkerProcess) {
  const electron = require('electron')
  app = electron.app
  BrowserWindow = electron.BrowserWindow
}

// Global cancellation flag
let installationCancelled = false
let currentDownloadRequest = null
let currentChildProcess = null

/**
 * Get user data directory
 * @returns {string} - User data directory path
 */
function getUserDataDir() {
  if (isWorkerProcess) {
    // In worker process, use environment variable
    return process.env.USER_DATA_DIR
  } else {
    // In main process, use app.getPath
    return app.getPath('userData')
  }
}

/**
 * Cancel the current ComfyUI installation
 */
function cancelInstallation() {
  console.log('🦄 Cancelling ComfyUI installation...')
  installationCancelled = true

  // Cancel ongoing download
  if (currentDownloadRequest) {
    currentDownloadRequest.destroy()
    currentDownloadRequest = null
  }

  // Kill child processes
  if (currentChildProcess) {
    currentChildProcess.kill('SIGTERM')
    currentChildProcess = null
  }

  sendCancelled('Installation cancelled by user')
}

/**
 * Reset cancellation state
 */
function resetCancellationState() {
  installationCancelled = false
  currentDownloadRequest = null
  currentChildProcess = null
}

/**
 * Check if installation is cancelled
 * @returns {boolean} - True if cancelled
 */
function isInstallationCancelled() {
  return installationCancelled
}

/**
 * Get the latest ComfyUI release information from GitHub
 * @returns {Promise<{version: string, downloadUrl: string}>} - Promise resolving to latest release info
 */
async function getLatestComfyUIRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/comfyanonymous/ComfyUI/releases/latest',
      method: 'GET',
      headers: {
        'User-Agent': 'Jaaz-App/1.0.0',
        Accept: 'application/vnd.github.v3+json',
      },
    }

    const req = https.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          const release = JSON.parse(data)

          if (res.statusCode !== 200) {
            reject(
              new Error(
                `GitHub API error: ${res.statusCode} - ${release.message || 'Unknown error'
                }`
              )
            )
            return
          }

          // Find the Windows portable NVIDIA version
          const windowsPortableAsset = release.assets.find(
            (asset) =>
              asset.name.includes('windows_portable') &&
              asset.name.includes('nvidia') &&
              (asset.name.endsWith('.7z') || asset.name.endsWith('.zip'))
          )

          if (!windowsPortableAsset) {
            // Fallback to any Windows portable version
            const fallbackAsset = release.assets.find(
              (asset) =>
                asset.name.includes('windows_portable') &&
                (asset.name.endsWith('.7z') || asset.name.endsWith('.zip'))
            )

            if (!fallbackAsset) {
              reject(
                new Error(
                  'No suitable Windows portable version found in latest release'
                )
              )
              return
            }

            resolve({
              version: release.tag_name,
              downloadUrl: fallbackAsset.browser_download_url,
              fileName: fallbackAsset.name,
              size: fallbackAsset.size,
              digest: fallbackAsset.digest,
            })
            return
          }

          resolve({
            version: release.tag_name,
            downloadUrl: windowsPortableAsset.browser_download_url,
            fileName: windowsPortableAsset.name,
            size: windowsPortableAsset.size,
            digest: windowsPortableAsset.digest,
          })
        } catch (error) {
          reject(
            new Error(`Failed to parse GitHub API response: ${error.message}`)
          )
        }
      })
    })

    req.on('error', (error) => {
      reject(new Error(`GitHub API request failed: ${error.message}`))
    })

    req.setTimeout(10000, () => {
      req.destroy()
      reject(new Error('GitHub API request timeout'))
    })

    req.end()
  })
}

/**
 * Send progress update to main window or parent process
 * @param {number} percent - Progress percentage
 * @param {string} status - Status message
 */
function sendProgress(percent, status) {
  if (isWorkerProcess) {
    // In worker process, send to parent process
    if (process.send) {
      process.send({
        type: 'progress',
        percent: percent,
        status: status,
      })
    }
  } else {
    // In main process, send to renderer
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(`
        window.dispatchEvent(new CustomEvent('comfyui-install-progress', {
          detail: { percent: ${percent}, status: "${status.replace(
        /"/g,
        '\\"'
      )}" }
        }));
      `)
    }
  }
}

/**
 * Send log message to main window or parent process
 * @param {string} message - Log message
 */
function sendLog(message) {
  if (isWorkerProcess) {
    // In worker process, send to parent process
    if (process.send) {
      process.send({
        type: 'log',
        message: message,
      })
    }
  } else {
    // In main process, send to renderer
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(`
        window.dispatchEvent(new CustomEvent('comfyui-install-log', {
          detail: { message: "${message.replace(/"/g, '\\"')}" }
        }));
      `)
    }
  }
  console.log(`[ComfyUI Install] ${message}`)
}

/**
 * Send error message to main window or parent process
 * @param {string} error - Error message
 */
function sendError(error) {
  const errorMessage = error || 'Unknown error occurred'

  if (isWorkerProcess) {
    // In worker process, send to parent process
    if (process.send) {
      process.send({
        type: 'error',
        error: errorMessage,
      })
    }
  } else {
    // In main process, send to renderer
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(`
        window.dispatchEvent(new CustomEvent('comfyui-install-error', {
          detail: { error: "${errorMessage.replace(/"/g, '\\"')}" }
        }));
      `)
    }
  }
}

/**
 * Send cancellation message to main window or parent process
 * @param {string} message - Cancellation message
 */
function sendCancelled(message) {
  const cancelMessage = message || 'Installation cancelled'

  if (isWorkerProcess) {
    // In worker process, send to parent process
    if (process.send) {
      process.send({
        type: 'cancelled',
        message: cancelMessage,
      })
    }
  } else {
    // In main process, send to renderer
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(`
        window.dispatchEvent(new CustomEvent('comfyui-install-cancelled', {
          detail: { message: "${cancelMessage.replace(/"/g, '\\"')}" }
        }));
      `)
    }
  }
  console.log(`[ComfyUI Install Cancelled] ${cancelMessage}`)
}

/**
 * Calculate SHA256 hash of a file
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} - Promise resolving to SHA256 hash in hex format
 */
async function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)

    stream.on('data', (data) => {
      hash.update(data)
    })

    stream.on('end', () => {
      resolve(hash.digest('hex'))
    })

    stream.on('error', (error) => {
      reject(new Error(`Failed to calculate file hash: ${error.message}`))
    })
  })
}

/**
 * Verify file integrity using SHA256 hash
 * @param {string} filePath - Path to the file
 * @param {string} expectedDigest - Expected digest in format "sha256:hash" or just "hash"
 * @returns {Promise<boolean>} - Promise resolving to true if hash matches
 */
async function verifyFileIntegrity(filePath, expectedDigest) {
  if (!expectedDigest) {
    return false // Can't verify without expected hash
  }

  try {
    const fileHash = await calculateFileHash(filePath)

    // Extract hash from digest (handle "sha256:hash" format)
    const expectedHash = expectedDigest.startsWith('sha256:')
      ? expectedDigest.substring(7)
      : expectedDigest

    return fileHash.toLowerCase() === expectedHash.toLowerCase()
  } catch (error) {
    console.error('Error verifying file integrity:', error)
    return false
  }
}

/**
 * Helper function to download files with resume support and retry mechanism using Got
 * @param {string} url - Download URL
 * @param {string} filePath - Local file path
 * @param {Function} onProgress - Progress callback
 * @param {Object} options - Download options
 * @returns {Promise<void>}
 */
async function downloadFile(url, filePath, onProgress, options = {}) {
  const { maxRetries = 5, timeout = 60000, retryDelay = 2000 } = options

  // Outer retry loop for full download attempts
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      sendLog(`Download attempt ${attempt}/${maxRetries}`)

      // Check if file already exists for resume
      let resumeSize = 0
      if (fs.existsSync(filePath)) {
        try {
          const stats = fs.statSync(filePath)
          resumeSize = stats.size
          if (resumeSize > 0) {
            sendLog(
              `Resuming download from ${Math.round(resumeSize / 1024 / 1024)}MB`
            )
          }
        } catch (error) {
          sendLog('Could not get existing file size, starting fresh download')
          resumeSize = 0
        }
      }

      const downloadOptions = {
        retry: {
          limit: 3,
          methods: ['GET'],
          statusCodes: [408, 413, 429, 500, 502, 503, 504, 521, 522, 524],
          errorCodes: [
            'ETIMEDOUT',
            'ECONNRESET',
            'EADDRINUSE',
            'ECONNREFUSED',
            'EPIPE',
            'ENOTFOUND',
            'ENETUNREACH',
            'EAI_AGAIN',
          ],
        },
        timeout: {
          request: timeout,
        },
        headers: {
          'User-Agent': 'Jaaz-App/1.0.0',
        },
      }

      // Add range header for resume
      if (resumeSize > 0) {
        downloadOptions.headers.Range = `bytes=${resumeSize}-`
      }

      // Check cancellation before starting
      if (isInstallationCancelled()) {
        throw new Error('Installation cancelled')
      }

      // Create write stream (append mode for resume)
      const writeStream = createWriteStream(filePath, {
        flags: resumeSize > 0 ? 'a' : 'w',
      })

      let totalSize = 0
      let downloadedSize = resumeSize
      let lastProgressUpdate = Date.now()

      // Create download stream using Got
      const downloadStream = got.stream(url, downloadOptions)
      currentDownloadRequest = downloadStream

      let streamError = null

      // Handle response to get total size
      downloadStream.on('response', (response) => {
        if (isInstallationCancelled()) {
          downloadStream.destroy()
          writeStream.destroy()
          return
        }

        if (response.headers['content-length']) {
          const contentLength = parseInt(response.headers['content-length'])
          if (response.statusCode === 206) {
            // Partial content - get total size from content-range header
            const contentRange = response.headers['content-range']
            if (contentRange) {
              const match = contentRange.match(/bytes \d+-\d+\/(\d+)/)
              if (match) {
                totalSize = parseInt(match[1])
              }
            }
          } else {
            totalSize = contentLength
          }
        }

        sendLog(`Total file size: ${Math.round(totalSize / 1024 / 1024)}MB`)

        if (response.statusCode === 206) {
          sendLog('Server supports resume, continuing download')
        } else if (resumeSize > 0) {
          sendLog('Server does not support resume, restarting download')
          writeStream.destroy()
          downloadedSize = 0
          try {
            fs.unlinkSync(filePath)
          } catch (error) {
            // Ignore if file doesn't exist
          }
        }
      })

      // Handle download progress
      downloadStream.on('data', (chunk) => {
        if (isInstallationCancelled()) {
          downloadStream.destroy()
          writeStream.destroy()
          return
        }

        downloadedSize += chunk.length

        // Throttle progress updates
        const now = Date.now()
        if (
          totalSize > 0 &&
          (now - lastProgressUpdate > 500 || downloadedSize >= totalSize)
        ) {
          const progress = downloadedSize / totalSize
          onProgress(progress)
          lastProgressUpdate = now
        }
      })

      // Handle errors
      downloadStream.on('error', (error) => {
        streamError = error
        if (writeStream && !writeStream.destroyed) {
          writeStream.destroy()
        }
        currentDownloadRequest = null
      })

      // Handle stream end
      downloadStream.on('end', () => {
        currentDownloadRequest = null
      })

      // Use pipeline for proper error handling and cleanup
      try {
        await pipeline(downloadStream, writeStream)
      } catch (pipelineError) {
        // If there was a stream error, use that instead
        throw streamError || pipelineError
      }

      // Check for stream errors after pipeline completes
      if (streamError) {
        throw streamError
      }

      // Verify file size if known
      if (totalSize > 0) {
        const stats = fs.statSync(filePath)
        if (stats.size !== totalSize) {
          throw new Error(
            `File size mismatch: expected ${totalSize}, got ${stats.size}`
          )
        }
      }

      sendLog('Download completed successfully')
      return // Success, exit retry loop
    } catch (error) {
      currentDownloadRequest = null

      // Check if it's a cancellation
      if (isInstallationCancelled()) {
        throw new Error('Installation cancelled')
      }

      sendLog(`Download attempt ${attempt} failed: ${error.message}`)

      // If this is not the last attempt, wait and retry
      if (attempt < maxRetries) {
        // Keep partial file for network errors, remove for others
        const isNetworkError =
          error.code &&
          [
            'ETIMEDOUT',
            'ECONNRESET',
            'ECONNREFUSED',
            'ENOTFOUND',
            'ENETUNREACH',
            'EPIPE',
          ].includes(error.code)

        if (!isNetworkError && fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath)
            sendLog('Removed corrupted partial file, will restart download')
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
        } else {
          sendLog('Keeping partial file for resume')
        }

        // Wait before retry with exponential backoff
        // const delay = Math.min(retryDelay * Math.pow(2, attempt - 1), 30000)
        const delay = 3000 // 3s for quick retry
        sendLog(`Waiting ${Math.round(delay / 1000)}s before retry...`)
        await new Promise((resolve) => setTimeout(resolve, delay))

        // Check cancellation after delay
        if (isInstallationCancelled()) {
          throw new Error('Installation cancelled')
        }

        continue // Try next attempt
      } else {
        // Last attempt failed, clean up and throw
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath)
          } catch (cleanupError) {
            // Ignore cleanup errors
          }
        }
        throw new Error(
          `Download failed after ${maxRetries} attempts: ${error.message}`
        )
      }
    }
  }
}

/**
 * Find ComfyUI main directory (may be in subdirectory after extraction)
 * @param {string} comfyUIDir - ComfyUI installation directory
 * @returns {string|null} - Main directory path or null if not found
 */
function findComfyUIMainDir(comfyUIDir) {
  const possibleDirs = ['ComfyUI_windows_portable']

  for (const dir of possibleDirs) {
    const dirPath = path.join(comfyUIDir, dir)
    if (fs.existsSync(dirPath)) {
      return dirPath
    }
  }

  return null
}

/**
 * Update configuration, add ComfyUI models
 * @returns {Promise<void>}
 */
async function updateConfigWithComfyUI() {
  try {
    // Call backend API to update configuration
    const response = await fetch(
      'http://127.0.0.1:8088/api/comfyui/update_config',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (response.ok) {
      const result = await response.json()
      console.log('ComfyUI configuration updated successfully:', result.message)
    } else {
      const error = await response.text()
      console.error('Configuration update failed:', error)
      throw new Error(`Configuration update failed: ${error}`)
    }
  } catch (error) {
    console.error('Configuration update failed:', error)
    throw error
  }
}

/**
 * Uninstall ComfyUI
 * @returns {Promise<{success: boolean}>} - Promise resolving to uninstallation result
 */
async function uninstallComfyUI() {
  console.log('🦄 Starting ComfyUI uninstallation...')

  try {
    // Get user data directory
    const userDataDir = getUserDataDir()
    if (!userDataDir) {
      throw new Error('Unable to get user data directory')
    }

    const comfyUIDir = path.join(userDataDir, 'comfyui')
    const tempDir = path.join(userDataDir, 'temp')

    sendLog('Starting ComfyUI uninstallation...')
    sendProgress(10, 'Checking ComfyUI installation...')

    // Check if ComfyUI directory exists
    if (!fs.existsSync(comfyUIDir)) {
      sendLog('ComfyUI directory not found, nothing to uninstall')
      sendProgress(100, 'ComfyUI is not installed')
      return { success: true, message: 'ComfyUI is not installed' }
    }

    sendProgress(30, 'Removing ComfyUI files...')
    sendLog('Removing ComfyUI installation directory...')

    // Remove ComfyUI directory
    fs.rmSync(comfyUIDir, { recursive: true, force: true })
    sendLog('ComfyUI directory removed successfully')

    sendProgress(80, 'Cleaning up temporary files...')
    sendLog('Cleaning up temporary installation files...')

    // Clean up ComfyUI temp download 7z file
    if (fs.existsSync(tempDir)) {
      const tempFiles = fs.readdirSync(tempDir)
      const comfyUIFiles = tempFiles.filter(
        (file) => file.includes('ComfyUI') && file.endsWith('.7z')
      )

      for (const file of comfyUIFiles) {
        try {
          fs.unlinkSync(path.join(tempDir, file))
          sendLog(`Removed temporary file: ${file}`)
        } catch (error) {
          sendLog(`Failed to remove temporary file ${file}`)
        }
      }
    }

    sendProgress(100, 'Uninstallation completed!')
    sendLog('ComfyUI uninstallation completed successfully!')

    return { success: true }
  } catch (error) {
    console.error('ComfyUI uninstallation failed:', error)
    sendError(error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Install ComfyUI
 * @returns {Promise<{success: boolean}>} - Promise resolving to installation result
 */
async function installComfyUI() {
  console.log('🦄 Starting ComfyUI installation...')

  try {
    // Reset cancellation state at start
    resetCancellationState()

    // Get user data directory and temp directory
    const userDataDir = getUserDataDir()
    if (!userDataDir) {
      throw new Error('Unable to get user data directory')
    }

    const tempDir = path.join(userDataDir, 'temp')
    const comfyUIDir = path.join(userDataDir, 'comfyui')

    // Ensure directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    sendLog('Starting ComfyUI installation...')
    sendProgress(5, 'Fetching latest ComfyUI version...')

    // Check cancellation
    if (isInstallationCancelled()) {
      throw new Error('Installation cancelled')
    }

    // Get latest ComfyUI release information
    let releaseInfo
    try {
      sendLog('Fetching latest ComfyUI release from GitHub...')
      releaseInfo = await getLatestComfyUIRelease()
      sendLog(`Found latest version: ${releaseInfo.version}`)
      sendLog(
        `Download file: ${releaseInfo.fileName} (${Math.round(
          releaseInfo.size / 1024 / 1024
        )}MB)`
      )
    } catch (error) {
      sendLog(`Failed to fetch latest release: ${error.message}`)
      sendLog('Falling back to default version...')
      // Fallback to hardcoded version
      releaseInfo = {
        version: 'v0.3.39',
        downloadUrl:
          'https://github.com/comfyanonymous/ComfyUI/releases/download/v0.3.39/ComfyUI_windows_portable_nvidia.7z',
        fileName: 'ComfyUI_windows_portable_nvidia.7z',
      }
    }

    // Check cancellation
    if (isInstallationCancelled()) {
      throw new Error('Installation cancelled')
    }

    sendProgress(10, 'Checking existing files...')

    const zipPath = path.join(tempDir, releaseInfo.fileName)

    // Check if already downloaded
    let shouldDownload = true
    if (fs.existsSync(zipPath)) {
      sendLog('Found existing installation package, checking integrity...')
      try {
        // Try SHA256 verification first if digest is available
        if (releaseInfo.digest) {
          sendLog('Verifying file integrity using SHA256...')
          const isValid = await verifyFileIntegrity(zipPath, releaseInfo.digest)
          if (isValid) {
            sendLog('File integrity verified successfully, skipping download')
            shouldDownload = false
          } else {
            sendLog('File integrity verification failed, re-downloading')
            fs.unlinkSync(zipPath)
          }
        } else {
          // Fallback to size check for older releases without digest
          sendLog('No SHA256 digest available, using size check...')
          const stats = fs.statSync(zipPath)
          if (stats.size > 1000000) {
            // At least 1MB, simple integrity check
            sendLog(
              'Installation package appears complete based on size, skipping download'
            )
            shouldDownload = false
          } else {
            sendLog('Installation package is incomplete, re-downloading')
            fs.unlinkSync(zipPath)
          }
        }
      } catch (error) {
        sendLog(
          `Error checking installation package: ${error.message}, re-downloading`
        )
        shouldDownload = true
      }
    }

    // Check cancellation
    if (isInstallationCancelled()) {
      throw new Error('Installation cancelled')
    }

    if (shouldDownload) {
      sendProgress(15, 'Starting ComfyUI download...')
      sendLog(
        `Downloading ComfyUI ${releaseInfo.version} from ${releaseInfo.downloadUrl}...`
      )

      // Download with enhanced retry configuration for large files
      await downloadFile(
        releaseInfo.downloadUrl,
        zipPath,
        (progress) => {
          const percent = 15 + progress * 60 // 15-75% for download
          sendProgress(percent, `Downloading... ${Math.round(progress * 100)}%`)
        },
        {
          maxRetries: 10, // Increase retry attempts for large files
          timeout: 120000, // 2 minutes timeout per request
          retryDelay: 3000, // Start with 3 second delay
        }
      )

      sendLog('Download completed')
    }

    // Check cancellation
    if (isInstallationCancelled()) {
      throw new Error('Installation cancelled')
    }

    sendProgress(75, 'Extracting installation package...')
    sendLog('Starting ComfyUI extraction...')

    // Extract files
    if (fs.existsSync(comfyUIDir)) {
      sendLog('Removing old ComfyUI directory...')
      fs.rmSync(comfyUIDir, { recursive: true, force: true })
    }

    // Check cancellation
    if (isInstallationCancelled()) {
      throw new Error('Installation cancelled')
    }

    try {
      // ComfyUI packages are only available in 7z format
      sendLog('Extracting 7z archive...')
      await _7z.unpack(zipPath, comfyUIDir)
      sendLog('Extraction completed')
    } catch (error) {
      sendLog(`Extraction failed: ${error.message}`)
      throw error
    }

    // Check cancellation
    if (isInstallationCancelled()) {
      throw new Error('Installation cancelled')
    }

    sendProgress(85, 'Configuring ComfyUI...')
    sendLog('Configuring ComfyUI environment...')

    // Find ComfyUI main directory (may be in subdirectory after extraction)
    const comfyUIMainDir = findComfyUIMainDir(comfyUIDir)
    if (!comfyUIMainDir) {
      throw new Error('ComfyUI main directory not found')
    }

    sendLog(`Found ComfyUI main directory: ${comfyUIMainDir}`)

    // Check cancellation
    if (isInstallationCancelled()) {
      throw new Error('Installation cancelled')
    }

    sendProgress(90, 'Updating configuration...')
    sendLog('Updating application configuration...')

    // Update configuration, add ComfyUI as image model
    try {
      await updateConfigWithComfyUI()
      sendLog('Configuration updated successfully')
    } catch (error) {
      sendLog(`Configuration update failed: ${error.message}`)
      // Don't fail the installation if config update fails
    }

    // Check cancellation
    if (isInstallationCancelled()) {
      throw new Error('Installation cancelled')
    }

    sendProgress(100, 'Installation completed!')
    sendLog('ComfyUI installation completed successfully!')
    sendLog('ComfyUI is ready to use at http://127.0.0.1:8188')
    sendLog('You can now enable ComfyUI in settings to start the service.')

    return { success: true }
  } catch (error) {
    console.error('ComfyUI installation failed:', error)

    if (error.message === 'Installation cancelled') {
      sendCancelled('Installation was cancelled by user')
      return { cancelled: true }
    } else {
      sendError(error.message)
      return { success: false, error: error.message }
    }
  }
}

// Worker process logic
if (isWorkerProcess) {
  console.log('🦄 ComfyUI install worker process started and ready')

  // Handle uncaught exceptions to prevent process crash
  process.on('uncaughtException', (error) => {
    console.error('🦄 Uncaught exception in worker process:', error)

    // Send error message to parent process
    if (process.send) {
      process.send({
        type: 'install-error',
        success: false,
        error: `Uncaught exception: ${error.message}`,
      })
    }

    // Don't exit, let the parent process handle it
  })

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('🦄 Unhandled promise rejection in worker process:', reason)

    // Send error message to parent process
    if (process.send) {
      process.send({
        type: 'install-error',
        success: false,
        error: `Unhandled promise rejection: ${reason}`,
      })
    }

    // Don't exit, let the parent process handle it
  })

  // Handle process messages
  process.on('message', async (message) => {
    if (message.type === 'start-install') {
      try {
        console.log('🦄 Starting ComfyUI installation in worker process...')
        const result = await installComfyUI()

        // Check if installation was cancelled
        if (result.cancelled) {
          process.send({
            type: 'install-cancelled',
            success: true,
            message: result.message || 'Installation cancelled',
          })
        } else if (result.success) {
          // Send success result back to main process
          process.send({
            type: 'install-complete',
            success: true,
            result: result,
          })
        } else {
          // Send error result back to main process
          process.send({
            type: 'install-error',
            success: false,
            error: result.error || 'Unknown error occurred',
          })
        }
      } catch (error) {
        console.error(
          '🦄 ComfyUI installation failed in worker process:',
          error
        )

        // Send error result back to main process
        process.send({
          type: 'install-error',
          success: false,
          error: error.message || 'Unknown error occurred',
        })
      }
    } else if (message.type === 'start-uninstall') {
      try {
        console.log('🦄 Starting ComfyUI uninstallation in worker process...')
        const result = await uninstallComfyUI()

        if (result.success) {
          // Send success result back to main process
          process.send({
            type: 'uninstall-complete',
            success: true,
            result: result,
          })
        } else {
          // Send error result back to main process
          process.send({
            type: 'uninstall-error',
            success: false,
            error: result.error || 'Unknown error occurred',
          })
        }
      } catch (error) {
        console.error(
          '🦄 ComfyUI uninstallation failed in worker process:',
          error
        )

        // Send error result back to main process
        process.send({
          type: 'uninstall-error',
          success: false,
          error: error.message || 'Unknown error occurred',
        })
      }
    } else if (message.type === 'cancel-install') {
      console.log('🦄 Received cancellation request in worker process')
      cancelInstallation()

      process.send({
        type: 'install-cancelled',
        success: true,
        message: 'Installation cancelled',
      })
    }
  })

  // Handle process exit
  process.on('exit', (code) => {
    console.log(`🦄 ComfyUI install worker process exiting with code ${code}`)
  })

  process.on('SIGTERM', () => {
    console.log('🦄 ComfyUI install worker process received SIGTERM')
    process.exit(0)
  })

  process.on('SIGINT', () => {
    console.log('🦄 ComfyUI install worker process received SIGINT')
    process.exit(0)
  })
}

module.exports = {
  installComfyUI,
  uninstallComfyUI,
  cancelInstallation,
  resetCancellationState,
  isInstallationCancelled,
  getLatestComfyUIRelease,
  downloadFile,
  findComfyUIMainDir,
  updateConfigWithComfyUI,
  calculateFileHash,
  verifyFileIntegrity,
}
