Page({
  data: { id: '' },

  onLoad(options) {
    this.setData({ id: options.id || '' })
  },

  viewPost() {
    wx.redirectTo({ url: `/pages/detail/detail?id=${this.data.id}` })
  },

  goHome() {
    wx.reLaunch({ url: '/pages/home/home' })
  },

  publishAnother() {
    wx.reLaunch({ url: '/pages/publish/publish' })
  }
})
