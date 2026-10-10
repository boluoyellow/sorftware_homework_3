const store = require('../../utils/store')

Page({
  data: { id: '', item: null, loadState: 'loading', imageLoadFailed: false, contactVisible: false },

  onLoad(options) {
    this.setData({ id: options.id || '', loadState: 'loading' })
  },

  onShow() {
    this.loadItem()
  },

  onShareAppMessage() {
    const item = this.data.item
    return {
      title: item ? `${item.type === 'lost' ? '寻物' : '招领'}：${item.title}` : '拾光校园寻物',
      path: this.data.id ? `/pages/detail/detail?id=${encodeURIComponent(this.data.id)}` : '/pages/home/home'
    }
  },

  async loadItem() {
    const requestId = (this._loadRequest || 0) + 1
    this._loadRequest = requestId
    if (!this.data.id) {
      this.setData({ item: null, loadState: 'missing' })
      return
    }
    this.setData({ loadState: 'loading', contactVisible: false })
    try {
      const item = await store.getById(this.data.id)
      if (this._loadRequest !== requestId) return
      const viewItem = item ? { ...item, ownerInitial: (item.owner || '同学').slice(0, 1) } : null
      this.setData({ item: viewItem, loadState: item ? 'ready' : 'missing', imageLoadFailed: false })
      if (item) wx.setNavigationBarTitle({ title: item.title })
    } catch (error) {
      if (this._loadRequest !== requestId) return
      console.error(error)
      this.setData({ loadState: 'error' })
    }
  },

  imageError() {
    this.setData({ imageLoadFailed: true })
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) wx.navigateBack()
    else wx.reLaunch({ url: '/pages/home/home' })
  },

  async toggleFavorite() {
    try {
      const item = await store.toggleFavorite(this.data.id)
      this.setData({ item: { ...item, ownerInitial: (item.owner || '同学').slice(0, 1) } })
      wx.showToast({ title: item.favorite ? '已收藏' : '已取消收藏', icon: 'none' })
    } catch (error) {
      console.error(error)
      wx.showToast({ title: '操作失败，请重试', icon: 'none' })
    }
  },

  showContact() {
    this.setData({ contactVisible: true })
  },

  hideContact() {
    this.setData({ contactVisible: false })
  },

  stopPropagation() {},

  copyContact() {
    wx.setClipboardData({
      data: this.data.item.contact,
      success: () => {
        this.hideContact()
        wx.showToast({ title: '联系方式已复制' })
      }
    })
  },

  report() {
    const reasons = ['信息已经失效', '疑似虚假信息', '包含不当内容']
    wx.showActionSheet({
      itemList: reasons,
      success: async (result) => {
        try {
          await store.report(this.data.id, reasons[result.tapIndex])
          wx.showToast({ title: '反馈已提交', icon: 'none' })
        } catch (error) {
          console.error(error)
          wx.showToast({ title: '提交失败，请重试', icon: 'none' })
        }
      }
    })
  },

  goHome() {
    wx.reLaunch({ url: '/pages/home/home' })
  }
})
