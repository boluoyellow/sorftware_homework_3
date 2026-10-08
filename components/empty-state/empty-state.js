Component({
  properties: {
    icon: { type: String, value: '🔎' },
    title: { type: String, value: '暂时没有内容' },
    description: { type: String, value: '换个筛选条件试试看吧' },
    actionText: { type: String, value: '' }
  },
  methods: {
    handleAction() {
      this.triggerEvent('action')
    }
  }
})
