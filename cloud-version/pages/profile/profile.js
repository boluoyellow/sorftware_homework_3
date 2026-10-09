const store = require('../../utils/store')

Page({
  data: {
    user: null,
    stats: { posts: 0, open: 0, solved: 0, favorites: 0 }
  },

  onShow() {
    this.refresh()
  },

  async refresh() {
    try {
      const [user, mine, favorites] = await Promise.all([
        store.loadUser(),
        store.getMine(),
        store.getFavorites()
      ])
      this.setData({
        user,
        stats: {
          posts: mine.length,
          open: mine.filter((item) => item.status === 'open').length,
          solved: mine.filter((item) => item.status === 'closed').length,
          favorites: favorites.length
        }
      })
    } catch (error) {
      console.error(error)
      wx.showToast({ title: '个人数据加载失败', icon: 'none' })
    }
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  goMyPosts() {
    wx.navigateTo({ url: '/pages/my-posts/my-posts' })
  },

  goFavorites() {
    wx.navigateTo({ url: '/pages/favorites/favorites' })
  }
})
