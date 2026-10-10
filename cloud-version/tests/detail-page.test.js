const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

function createPage(getById) {
  let definition
  let calls = 0
  const source = fs.readFileSync(path.join(__dirname, '../pages/detail/detail.js'), 'utf8')
  vm.runInNewContext(source, {
    Page(value) { definition = value },
    require() { return { getById: (id) => { calls++; return getById(id) } } },
    wx: { setNavigationBarTitle() {} }, console: { error() {} }
  })
  const page = { ...definition, data: { ...definition.data },
    setData(patch) { Object.assign(this.data, patch) }
  }
  return { page, calls: () => calls }
}

test('云请求尚未完成时只显示加载中，不误判已删除', async () => {
  let resolve
  const { page } = createPage(() => new Promise((done) => { resolve = done }))
  page.onLoad({ id: 'real-item' })
  const pending = page.loadItem()
  assert.equal(page.data.loadState, 'loading')
  assert.equal(page.data.item, null)
  resolve({ id: 'real-item', title: '笔记本', owner: '同学' })
  await pending
  assert.equal(page.data.loadState, 'ready')
  assert.equal(page.data.item.id, 'real-item')
})

test('网络失败显示可重试错误，不显示已删除；重试可恢复', async () => {
  let failed = true
  const { page } = createPage(async () => {
    if (failed) throw new Error('network unavailable')
    return { id: 'real-item', title: '笔记本' }
  })
  page.onLoad({ id: 'real-item' })
  await page.loadItem()
  assert.equal(page.data.loadState, 'error')
  failed = false
  await page.loadItem()
  assert.equal(page.data.loadState, 'ready')
})

test('仅在云端明确返回空结果时显示不存在', async () => {
  const { page } = createPage(async () => null)
  page.onLoad({ id: 'deleted-item' })
  await page.loadItem()
  assert.equal(page.data.loadState, 'missing')
})

test('无物品 ID 的入口不发无效云请求，分享回到首页', async () => {
  const { page, calls } = createPage(async () => { throw new Error('should not call') })
  page.onLoad({})
  await page.loadItem()
  assert.equal(calls(), 0)
  assert.equal(page.data.loadState, 'missing')
  assert.equal(page.onShareAppMessage().path, '/pages/home/home')
})

test('图片加载错误不改变详情存在状态', async () => {
  const { page } = createPage(async () => ({ id: 'real-item', title: '笔记本' }))
  page.onLoad({ id: 'real-item' })
  await page.loadItem()
  page.imageError()
  assert.equal(page.data.imageLoadFailed, true)
  assert.equal(page.data.loadState, 'ready')
})

test('较早的慢请求不能覆盖后一次成功重试的结果', async () => {
  const pending = []
  const { page } = createPage(() => new Promise((resolve) => pending.push(resolve)))
  page.onLoad({ id: 'real-item' })
  const first = page.loadItem()
  const second = page.loadItem()
  pending[1]({ id: 'real-item', title: '新结果' })
  await second
  pending[0](null)
  await first
  assert.equal(page.data.loadState, 'ready')
  assert.equal(page.data.item.title, '新结果')
})

test('底部导航分别进入首页、发布、我的，不进入详情错误页', () => {
  let component
  const destinations = []
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../components/bottom-nav/bottom-nav.js'), 'utf8'), {
    Component(value) { component = value },
    wx: { reLaunch({ url }) { destinations.push(url) } }
  })
  const nav = { data: { current: 'other' } }
  for (const method of ['goHome', 'goPublish', 'goProfile']) component.methods[method].call(nav)
  assert.deepEqual(destinations, ['/pages/home/home', '/pages/publish/publish', '/pages/profile/profile'])
})
