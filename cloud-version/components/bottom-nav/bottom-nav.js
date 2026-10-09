Component({
  properties: {
    current: {
      type: String,
      value: 'home'
    }
  },
  methods: {
    goHome() {
      if (this.data.current !== 'home') wx.reLaunch({ url: '/pages/home/home' })
    },
    goPublish() {
      if (this.data.current !== 'publish') wx.reLaunch({ url: '/pages/publish/publish' })
    },
    goProfile() {
      if (this.data.current !== 'profile') wx.reLaunch({ url: '/pages/profile/profile' })
    }
  }
})
