const store = require('../../utils/store')
const DRAFT_KEY = 'shiguang_publish_draft_v1'

Page({
  data: {
    type: 'lost',
    title: '',
    category: '数码',
    categoryIndex: 0,
    categories: ['数码', '证件钥匙', '书籍文具', '生活用品', '衣物饰品', '其他'],
    date: '',
    location: '',
    description: '',
    contact: '',
    image: '',
    submitting: false,
    draftState: '草稿自动保存'
  },

  onLoad(options) {
    const saved = wx.getStorageSync(DRAFT_KEY) || {}
    const categoryIndex = this.data.categories.indexOf(saved.category)
    const data = {
      ...saved,
      date: saved.date || this.formatToday(),
      categoryIndex: categoryIndex >= 0 ? categoryIndex : 0,
      draftState: Object.keys(saved).length ? '已恢复上次草稿' : '草稿自动保存'
    }
    if (options.type === 'found' || options.type === 'lost') data.type = options.type
    this.setData(data)
  },

  formatToday() {
    const now = new Date()
    const pad = (value) => String(value).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  },

  setType(event) {
    this.setData({ type: event.currentTarget.dataset.type }, () => this.saveDraft())
  },

  handleInput(event) {
    this.setData({ [event.currentTarget.dataset.field]: event.detail.value }, () => this.saveDraft())
  },

  handleCategory(event) {
    const categoryIndex = Number(event.detail.value)
    this.setData({ categoryIndex, category: this.data.categories[categoryIndex] }, () => this.saveDraft())
  },

  handleDate(event) {
    this.setData({ date: event.detail.value }, () => this.saveDraft())
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (result) => {
        const file = result.tempFiles && result.tempFiles[0]
        if (file) this.setData({ image: file.tempFilePath }, () => this.saveDraft())
      },
      fail: (error) => {
        if (!String(error.errMsg || '').includes('cancel')) {
          wx.showToast({ title: '暂时无法选择图片', icon: 'none' })
        }
      }
    })
  },

  removeImage() {
    this.setData({ image: '' }, () => this.saveDraft())
  },

  saveDraft() {
    const fields = ['type', 'title', 'category', 'date', 'location', 'description', 'contact', 'image']
    const draft = fields.reduce((result, field) => ({ ...result, [field]: this.data[field] }), {})
    wx.setStorageSync(DRAFT_KEY, draft)
    if (this.data.draftState !== '草稿已保存') this.setData({ draftState: '草稿已保存' })
  },

  submit() {
    if (this.data.submitting) return
    const required = [
      ['title', '请填写物品名称'],
      ['location', '请填写地点'],
      ['description', '请补充物品描述'],
      ['contact', '请填写联系方式']
    ]
    const invalid = required.find(([field]) => !this.data[field].trim())
    if (invalid) {
      wx.showToast({ title: invalid[1], icon: 'none' })
      return
    }
    if (this.data.description.trim().length < 6) {
      wx.showToast({ title: '描述再详细一点吧', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    try {
      const item = store.add({
        type: this.data.type,
        title: this.data.title,
        category: this.data.category,
        date: this.data.date,
        location: this.data.location,
        description: this.data.description,
        contact: this.data.contact,
        image: this.data.image
      })
      wx.removeStorageSync(DRAFT_KEY)
      wx.navigateTo({ url: `/pages/success/success?id=${item.id}` })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
