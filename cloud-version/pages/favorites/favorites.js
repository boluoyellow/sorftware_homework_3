const store = require('../../utils/store')

Page({
  data: { items: [] },

  onShow() {
    this.loadData()
  },

  async loadData() {
    try {
      this.setData({ items: await store.getFavorites() })
    } catch (error) {
      console.error(error)
      wx.showToast({ title: '收藏加载失败', icon: 'none' })
    }
  },

  goBack() {
    wx.navigateBack()
  },

  openDetail(event) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${event.detail.id}` })
  },

  async toggleFavorite(event) {
    try {
      await store.toggleFavorite(event.detail.id)
      await this.loadData()
      wx.showToast({ title: '已取消收藏', icon: 'none' })
    } catch (error) {
      console.error(error)
      wx.showToast({ title: '操作失败，请重试', icon: 'none' })
    }
  },

  goHome() {
    wx.reLaunch({ url: '/pages/home/home' })
  }
})
