const store = require('../../utils/store')

Page({
  data: {
    account: '',
    password: '',
    nickname: '',
    showPassword: false,
    submitting: false
  },

  onLoad() {
    const user = store.getUser()
    if (user) {
      this.setData({
        account: user.account || '',
        nickname: user.nickname || ''
      })
    }
  },

  goBack() {
    wx.navigateBack()
  },

  handleInput(event) {
    this.setData({ [event.currentTarget.dataset.field]: event.detail.value })
  },

  togglePassword() {
    this.setData({ showPassword: !this.data.showPassword })
  },

  submit() {
    if (!this.data.account.trim()) {
      wx.showToast({ title: '请输入账号', icon: 'none' })
      return
    }
    if (!this.data.password.trim()) {
      wx.showToast({ title: '请输入密码', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    const nickname = this.data.nickname.trim() || this.data.account.trim()
    store.setUser({
      account: this.data.account.trim(),
      nickname,
      initial: nickname.slice(0, 1),
      avatar: ''
    })
    setTimeout(() => {
      this.setData({ submitting: false })
      wx.showToast({ title: '登录成功' })
      setTimeout(() => wx.navigateBack(), 450)
    }, 350)
  },

  wechatLogin() {
    if (!wx.getUserProfile) {
      wx.showToast({ title: '当前版本不支持快捷登录', icon: 'none' })
      return
    }
    wx.getUserProfile({
      desc: '用于完善个人中心资料',
      success: (result) => {
        const nickname = result.userInfo.nickName || '微信用户'
        store.setUser({
          account: 'wechat_user',
          nickname,
          initial: nickname.slice(0, 1),
          avatar: result.userInfo.avatarUrl || ''
        })
        wx.showToast({ title: '登录成功' })
        setTimeout(() => wx.navigateBack(), 450)
      }
    })
  }
})
