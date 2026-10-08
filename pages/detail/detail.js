const store = require('../../utils/store')

Page({
  data: {
    id: '',
    item: null,
    contactVisible: false
  },

  onLoad(options) {
    this.setData({ id: options.id || '' })
  },

  onShow() {
    this.loadItem()
  },

  onShareAppMessage() {
    const item = this.data.item
    return {
      title: item ? `${item.type === 'lost' ? '寻物' : '招领'}：${item.title}` : '拾光校园寻物',
      path: `/pages/detail/detail?id=${this.data.id}`
    }
  },

  loadItem() {
    const item = store.getById(this.data.id)
    const viewItem = item ? { ...item, ownerInitial: (item.owner || '同学').slice(0, 1) } : null
    this.setData({ item: viewItem })
    if (item) wx.setNavigationBarTitle({ title: item.title })
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) wx.navigateBack()
    else wx.reLaunch({ url: '/pages/home/home' })
  },

  toggleFavorite() {
    const item = store.toggleFavorite(this.data.id)
    if (!item) return
    this.setData({ item: { ...item, ownerInitial: (item.owner || '同学').slice(0, 1) } })
    wx.showToast({ title: item.favorite ? '已收藏' : '已取消收藏', icon: 'none' })
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
    wx.showActionSheet({
      itemList: ['信息已经失效', '疑似虚假信息', '包含不当内容'],
      success: () => wx.showToast({ title: '感谢反馈，我们会尽快核查', icon: 'none' })
    })
  },

  goHome() {
    wx.reLaunch({ url: '/pages/home/home' })
  }
})
