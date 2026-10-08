const store = require('../../utils/store')

Page({
  data: { items: [] },

  onShow() {
    this.setData({ items: store.getFavorites() })
  },

  goBack() {
    wx.navigateBack()
  },

  openDetail(event) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${event.detail.id}` })
  },

  toggleFavorite(event) {
    store.toggleFavorite(event.detail.id)
    this.setData({ items: store.getFavorites() })
    wx.showToast({ title: '已取消收藏', icon: 'none' })
  },

  goHome() {
    wx.reLaunch({ url: '/pages/home/home' })
  }
})
