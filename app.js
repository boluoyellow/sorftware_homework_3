const store = require('./utils/store')

App({
  onLaunch() {
    store.bootstrap()
  },
  globalData: {
    appName: '拾光',
    user: null
  }
})
