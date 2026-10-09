const store = require('../../utils/store')

Page({
  data: {
    currentStatus: 'all',
    tabs: [
      { key: 'all', label: '全部' },
      { key: 'open', label: '进行中' },
      { key: 'closed', label: '已解决' }
    ],
    allItems: [], items: [], counts: { all: 0, open: 0, closed: 0 }
  },

  onShow() {
    this.loadData()
  },

  async loadData() {
    try {
      const allItems = await store.getMine()
      this.setData({
        allItems,
        counts: {
          all: allItems.length,
          open: allItems.filter((item) => item.status === 'open').length,
          closed: allItems.filter((item) => item.status === 'closed').length
        }
      }, () => this.filterItems())
    } catch (error) {
      console.error(error)
      wx.showToast({ title: '发布记录加载失败', icon: 'none' })
    }
  },

  goBack() {
    wx.navigateBack()
  },

  changeStatus(event) {
    this.setData({ currentStatus: event.currentTarget.dataset.status }, () => this.filterItems())
  },

  filterItems() {
    const items = this.data.currentStatus === 'all'
      ? this.data.allItems
      : this.data.allItems.filter((item) => item.status === this.data.currentStatus)
    this.setData({ items })
  },

  openDetail(event) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${event.detail.id}` })
  },

  async toggleFavorite(event) {
    try {
      await store.toggleFavorite(event.detail.id)
      await this.loadData()
    } catch (error) {
      console.error(error)
      wx.showToast({ title: '操作失败，请重试', icon: 'none' })
    }
  },

  markSolved(event) {
    const id = event.currentTarget.dataset.id
    wx.showModal({
      title: '确认已经解决？',
      content: '标记后，这条信息仍会保留在“我的发布”中。',
      confirmText: '确认解决',
      success: async (result) => {
        if (!result.confirm) return
        try {
          await store.update(id, { status: 'closed' })
          await this.loadData()
          wx.showToast({ title: '已标记为解决' })
        } catch (error) {
          console.error(error)
          wx.showToast({ title: '操作失败，请重试', icon: 'none' })
        }
      }
    })
  },

  async reopen(event) {
    try {
      await store.update(event.currentTarget.dataset.id, { status: 'open' })
      await this.loadData()
      wx.showToast({ title: '已重新开启', icon: 'none' })
    } catch (error) {
      console.error(error)
      wx.showToast({ title: '操作失败，请重试', icon: 'none' })
    }
  },

  deleteItem(event) {
    const id = event.currentTarget.dataset.id
    wx.showModal({
      title: '删除这条发布？',
      content: '删除后无法恢复，请确认信息已经不再需要。',
      confirmText: '删除',
      confirmColor: '#e8614f',
      success: async (result) => {
        if (!result.confirm) return
        try {
          await store.remove(id)
          await this.loadData()
          wx.showToast({ title: '已删除' })
        } catch (error) {
          console.error(error)
          wx.showToast({ title: '删除失败，请重试', icon: 'none' })
        }
      }
    })
  },

  goPublish() {
    wx.reLaunch({ url: '/pages/publish/publish' })
  }
})
