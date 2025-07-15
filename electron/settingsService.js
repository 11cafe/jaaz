const fs = require('fs')
const path = require('path')
const { app, session } = require('electron')
const osProxyConfig = require('os-proxy-config')

/**
 * Settings Service for Electron App
 * 处理应用设置的读取和代理配置
 */
class SettingsService {
  constructor() {
    this.settingsPath = null
    this.cachedSettings = null
  }

  /**
   * 获取设置文件路径
   * @returns {string} 设置文件的完整路径
   */
  getSettingsPath() {
    if (this.settingsPath) {
      return this.settingsPath
    }

    // 根据应用是否打包确定设置文件路径
    if (app.isPackaged) {
      // 打包后的应用，使用 userData 目录
      this.settingsPath = path.join(app.getPath('userData'), 'settings.json')
    } else {
      // 开发环境，使用 server/user_data 目录
      this.settingsPath = path.join(
        __dirname,
        '../server/user_data/settings.json'
      )
    }

    return this.settingsPath
  }

  /**
   * 读取设置文件
   * @returns {Object|null} 设置对象或 null
   */
  readSettings() {
    try {
      const settingsPath = this.getSettingsPath()
      console.log('Looking for settings file at:', settingsPath)

      // 检查设置文件是否存在
      if (!fs.existsSync(settingsPath)) {
        console.log('Settings file not found')
        return null
      }

      // 读取并解析设置文件
      const settingsContent = fs.readFileSync(settingsPath, 'utf-8')
      const settings = JSON.parse(settingsContent)

      // 缓存设置
      this.cachedSettings = settings

      console.log('Settings loaded:', settings)
      return settings
    } catch (error) {
      console.error('Error reading settings:', error)
      return null
    }
  }

  /**
   * 获取代理配置，如果配置文件不存在，则使用系统代理
   * @returns {string} 代理配置字符串
   */
  getProxyConfig() {
    const settings = this.readSettings()
    if (!settings) {
      console.log('Settings file not found, using default system proxy')
      return 'system'
    }

    const proxyUrl = settings.proxy || 'system'
    console.log('Proxy setting from settings.json:', proxyUrl)

    return proxyUrl
  }

  /**
   * 设置 Electron session 代理
   * @param {Object} config 代理配置对象
   */
  async setSessionsProxy(config) {
    const sessions = [
      session.defaultSession,
      session.fromPartition('persist:webview'), // copied from cherrystudio, not sure if needed
    ]
    await Promise.all(sessions.map((session) => session.setProxy(config)))
  }

  /**
   * 设置环境变量代理
   * @param {string} url 代理 URL
   */
  setEnvironment(url) {
    process.env.grpc_proxy = url
    process.env.HTTP_PROXY = url
    process.env.HTTPS_PROXY = url
    process.env.http_proxy = url
    process.env.https_proxy = url
    console.log('Environment proxy variables set to:', url)
  }

  /**
   * 设置系统代理
   * @returns {Object} 代理环境变量对象
   */
  async setSystemProxy() {
    try {
      console.log('Attempting to get system proxy...')
      const currentProxy = await osProxyConfig.getSystemProxy()

      if (!currentProxy) {
        console.log('No system proxy found')
        return {}
      }

      console.log('System proxy found:', currentProxy)

      // 设置 Electron session 代理
      await this.setSessionsProxy({ mode: 'system' })

      // 获取代理 URL 并设置环境变量
      const url = currentProxy.proxyUrl.toLowerCase()
      this.setEnvironment(url)

      return {
        grpc_proxy: url,
        HTTP_PROXY: url,
        HTTPS_PROXY: url,
        http_proxy: url,
        https_proxy: url,
      }
    } catch (error) {
      console.error('Failed to set system proxy:', error)
      return {}
    }
  }

  /**
   * 设置自定义代理
   * @param {string} proxyUrl 代理 URL
   * @returns {Object} 代理环境变量对象
   */
  async setCustomProxy(proxyUrl) {
    try {
      console.log('Setting custom proxy:', proxyUrl)

      // 设置 Electron session 代理
      await this.setSessionsProxy({
        mode: 'fixed_servers',
        proxyRules: proxyUrl,
      })

      // 设置环境变量
      this.setEnvironment(proxyUrl)

      return {
        grpc_proxy: proxyUrl,
        HTTP_PROXY: proxyUrl,
        HTTPS_PROXY: proxyUrl,
        http_proxy: proxyUrl,
        https_proxy: proxyUrl,
      }
    } catch (error) {
      console.error('Failed to set custom proxy:', error)
      return {}
    }
  }

  /**
   * 清除代理设置
   * @returns {Object} 空的代理环境变量对象
   */
  async clearProxy() {
    try {
      console.log('Clearing proxy settings')

      // 清除 Electron session 代理
      await this.setSessionsProxy({ mode: 'direct' })

      // 清除环境变量
      delete process.env.grpc_proxy
      delete process.env.HTTP_PROXY
      delete process.env.HTTPS_PROXY
      delete process.env.http_proxy
      delete process.env.https_proxy

      return {}
    } catch (error) {
      console.error('Failed to clear proxy:', error)
      return {}
    }
  }

  /**
   * 应用代理设置
   * @returns {Object} 代理环境变量对象
   */
  async applyProxySettings() {
    const proxyConfig = this.getProxyConfig()

    if (proxyConfig === 'no_proxy') {
      console.log('Proxy explicitly disabled, clearing proxy settings')
      return await this.clearProxy()
    }

    if (proxyConfig === 'system') {
      console.log('Using system proxy')
      return await this.setSystemProxy()
    }

    // 自定义代理 URL
    console.log('Using custom proxy:', proxyConfig)
    return await this.setCustomProxy(proxyConfig)
  }

  /**
   * 获取代理环境变量（用于传递给子进程）
   * @returns {Object} 包含代理环境变量的对象
   */
  async getProxyEnvironmentVariables() {
    return await this.applyProxySettings()
  }
}

// 导出单例实例
const settingsService = new SettingsService()
module.exports = settingsService
