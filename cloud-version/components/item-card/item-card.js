Component({
  data: { imageLoadFailed: false },
  observers: {
    'item.imageUrl': function () {
      this.setData({ imageLoadFailed: false })
    }
  },
  properties: {
    item: {
      type: Object,
      value: {}
    },
    compact: {
      type: Boolean,
      value: false
    }
  },
  methods: {
    imageError() {
      this.setData({ imageLoadFailed: true })
    },
    openDetail() {
      this.triggerEvent('open', { id: this.data.item.id })
    },
    toggleFavorite() {
      this.triggerEvent('favorite', { id: this.data.item.id })
    }
  }
})
