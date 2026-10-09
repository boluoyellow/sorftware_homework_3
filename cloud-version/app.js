const cloudConfig = require('./config/cloud')
const store = require('./utils/store')

App({
  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({
        title: '基础库版本过低',
        content: '当前微信版本不支持云开发，请升级微信后重试。',
        showCancel: false
      })
      return
    }

    const options = { traceUser: true }
    if (cloudConfig.envId) options.env = cloudConfig.envId
    wx.cloud.init(options)

    this.globalData.cloudReady = store.init()
    this.globalData.cloudReady.catch((error) => {
      console.error('云环境初始化失败', error)
    })
  },

  globalData: {
    appName: '拾光',
    cloudReady: null
  }
})
