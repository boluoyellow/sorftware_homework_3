const store = require('../../utils/store')

Page({
  data: {
    query: '',
    currentType: 'all',
    currentCategory: '全部',
    categories: ['全部', '数码', '证件钥匙', '书籍文具', '生活用品', '衣物饰品'],
    typeTabs: [
      { key: 'all', label: '全部' },
      { key: 'lost', label: '寻物' },
      { key: 'found', label: '招领' }
    ],
    allItems: [],
    filteredItems: [],
    openCount: 0,
    todayCount: 0
  },

  onShow() {
    this.loadData()
  },

  onPullDownRefresh() {
    this.loadData()
  },

  onShareAppMessage() {
    return { title: '拾光校园寻物｜让遗失都有回音', path: '/pages/home/home' }
  },

  async loadData() {
    wx.showNavigationBarLoading()
    try {
      const allItems = await store.getAll()
      const today = this.formatToday()
      this.setData({
        allItems,
        openCount: allItems.filter((item) => item.status === 'open').length,
        todayCount: allItems.filter((item) => item.date === today).length
      }, () => this.applyFilters())
    } catch (error) {
      console.error(error)
      wx.showToast({ title: '云端数据加载失败', icon: 'none' })
    } finally {
      wx.hideNavigationBarLoading()
      wx.stopPullDownRefresh()
    }
  },

  formatToday() {
    const date = new Date()
    const pad = (value) => String(value).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  },

  handleSearch(event) {
    this.setData({ query: event.detail.value }, () => this.applyFilters())
  },

  clearSearch() {
    this.setData({ query: '' }, () => this.applyFilters())
  },

  changeType(event) {
    this.setData({ currentType: event.currentTarget.dataset.type }, () => this.applyFilters())
  },

  changeCategory(event) {
    this.setData({ currentCategory: event.currentTarget.dataset.category }, () => this.applyFilters())
  },

  applyFilters() {
    const query = this.data.query.trim().toLowerCase()
    const filteredItems = this.data.allItems.filter((item) => {
      const matchType = this.data.currentType === 'all' || item.type === this.data.currentType
      const matchCategory = this.data.currentCategory === '全部' || item.category === this.data.currentCategory
      const text = `${item.title} ${item.description} ${item.location} ${item.category}`.toLowerCase()
      return matchType && matchCategory && (!query || text.includes(query))
    })
    this.setData({ filteredItems })
  },

  openDetail(event) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${event.detail.id}` })
  },

  async toggleFavorite(event) {
    try {
      const updated = await store.toggleFavorite(event.detail.id)
      await this.loadData()
      wx.showToast({ title: updated.favorite ? '已收藏' : '已取消收藏', icon: 'none' })
    } catch (error) {
      console.error(error)
      wx.showToast({ title: '操作失败，请重试', icon: 'none' })
    }
  },

  goPublish() {
    wx.reLaunch({ url: '/pages/publish/publish' })
  },

  resetFilters() {
    this.setData({ query: '', currentType: 'all', currentCategory: '全部' }, () => this.applyFilters())
  }
})
