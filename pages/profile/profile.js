const store = require('../../utils/store')

Page({
  data: {
    user: null,
    stats: {
      posts: 0,
      open: 0,
      solved: 0,
      favorites: 0
    }
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const user = store.getUser()
    const mine = store.getMine()
    const all = store.getAll()
    this.setData({
      user,
      stats: {
        posts: mine.length,
        open: mine.filter((item) => item.status === 'open').length,
        solved: mine.filter((item) => item.status === 'closed').length,
        favorites: all.filter((item) => item.favorite).length
      }
    })
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  goMyPosts() {
    wx.navigateTo({ url: '/pages/my-posts/my-posts' })
  },

  goFavorites() {
    wx.navigateTo({ url: '/pages/favorites/favorites' })
  },

  showService() {
    wx.showModal({
      title: '校园失物服务',
      content: '贵重物品建议同步联系学校保卫处；若遇到可疑索要或转账请求，请立即停止联系。',
      showCancel: false,
      confirmText: '我知道了'
    })
  },

  showAbout() {
    wx.showModal({
      title: '关于拾光',
      content: '拾光是一款校园寻物启事小程序，希望让每一次拾得与寻找都更高效、更温暖。',
      showCancel: false,
      confirmText: '很好'
    })
  },

  resetDemo() {
    wx.showModal({
      title: '恢复演示数据',
      content: '这会清除你本地新增的发布与收藏状态，确定继续吗？',
      confirmColor: '#e8614f',
      success: (result) => {
        if (!result.confirm) return
        store.resetDemo()
        this.refresh()
        wx.showToast({ title: '已恢复' })
      }
    })
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后本地发布数据仍会保留。',
      success: (result) => {
        if (!result.confirm) return
        store.logout()
        this.refresh()
      }
    })
  }
})
