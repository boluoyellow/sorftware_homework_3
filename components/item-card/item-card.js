Component({
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
    openDetail() {
      this.triggerEvent('open', { id: this.data.item.id })
    },
    toggleFavorite() {
      this.triggerEvent('favorite', { id: this.data.item.id })
    }
  }
})
