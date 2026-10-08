const test = require('node:test')
const assert = require('node:assert/strict')

const memory = Object.create(null)

global.wx = {
  getStorageSync(key) {
    return memory[key]
  },
  setStorageSync(key, value) {
    memory[key] = value
  },
  removeStorageSync(key) {
    delete memory[key]
  }
}

const store = require('../utils/store')

function clearStorage() {
  Object.keys(memory).forEach((key) => delete memory[key])
}

function sampleListing(overrides = {}) {
  return {
    type: 'lost',
    title: '  黑色双肩包  ',
    category: '生活用品',
    description: '  包侧面有一个白色钥匙扣  ',
    location: '  图书馆一楼  ',
    date: '2026-10-08',
    contact: '  微信：test_user  ',
    image: '',
    ...overrides
  }
}

test.beforeEach(clearStorage)

test('首次启动时写入演示数据，重复启动不会重复添加', () => {
  store.bootstrap()
  assert.equal(store.getAll().length, 5)
  store.bootstrap()
  assert.equal(store.getAll().length, 5)
})

test('发布信息时清理首尾空格并设置为进行中', () => {
  const item = store.add(sampleListing())
  assert.equal(item.title, '黑色双肩包')
  assert.equal(item.location, '图书馆一楼')
  assert.equal(item.description, '包侧面有一个白色钥匙扣')
  assert.equal(item.contact, '微信：test_user')
  assert.equal(item.status, 'open')
  assert.equal(item.mine, true)
})

test('根据物品分类自动匹配展示图标', () => {
  const item = store.add(sampleListing({ category: '书籍文具' }))
  assert.equal(item.emoji, '📚')
})

test('可以把自己的发布标记为已解决并重新开启', () => {
  const item = store.add(sampleListing())
  assert.equal(store.update(item.id, { status: 'closed' }).status, 'closed')
  assert.equal(store.update(item.id, { status: 'open' }).status, 'open')
})

test('收藏操作在收藏和取消收藏之间切换', () => {
  store.bootstrap()
  const id = store.getAll()[0].id
  assert.equal(store.toggleFavorite(id).favorite, true)
  assert.equal(store.toggleFavorite(id).favorite, false)
})

test('我的发布只返回当前用户新增的信息', () => {
  store.bootstrap()
  const mine = store.add(sampleListing())
  const result = store.getMine()
  assert.equal(result.length, 1)
  assert.equal(result[0].id, mine.id)
})

test('删除信息后无法再通过编号查询', () => {
  const item = store.add(sampleListing())
  store.remove(item.id)
  assert.equal(store.getById(item.id), undefined)
})

test('用户资料支持保存、读取和退出登录', () => {
  const user = { account: '20260001', nickname: '测试同学' }
  store.setUser(user)
  assert.deepEqual(store.getUser(), user)
  store.logout()
  assert.equal(store.getUser(), null)
})

test('恢复演示数据会清除本地新增信息', () => {
  store.add(sampleListing())
  store.resetDemo()
  assert.equal(store.getAll().length, 5)
  assert.equal(store.getMine().length, 0)
})
