const store = require('../../utils/store')

Page({
  data: { nickname: '', submitting: false },

  async onLoad() {
    const cached = store.getUser()
    if (cached) this.setData({ nickname: cached.nickname || '' })
    try {
      const user = await store.loadUser()
      if (user) this.setData({ nickname: user.nickname || '' })
    } catch (error) {
      console.error(error)
    }
  },

  goBack() {
    wx.navigateBack()
  },

  handleInput(event) {
    this.setData({ nickname: event.detail.value })
  },

  async submit() {
    const nickname = this.data.nickname.trim()
    if (!nickname) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      await store.setUser({ nickname, avatar: '' })
      wx.showToast({ title: '资料已保存' })
      setTimeout(() => wx.navigateBack(), 450)
    } catch (error) {
      console.error(error)
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
