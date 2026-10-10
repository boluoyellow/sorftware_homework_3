const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

function createPage(name, store = {}, initialMemory = {}) {
  let definition
  const memory = { ...initialMemory }
  const events = { toasts: [], routes: [], modals: [], timers: [], loading: [] }
  const wx = {
    getStorageSync(key) { return memory[key] },
    setStorageSync(key, value) { memory[key] = value },
    removeStorageSync(key) { delete memory[key] },
    showToast(value) { events.toasts.push(value) },
    navigateTo(value) { events.routes.push(value.url) },
    navigateBack() { events.routes.push('back') },
    reLaunch(value) { events.routes.push(value.url) },
    showModal(value) { events.modals.push(value) },
    showNavigationBarLoading() { events.loading.push('start') },
    hideNavigationBarLoading() { events.loading.push('stop') },
    stopPullDownRefresh() { events.loading.push('refresh-stop') }
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, `../pages/${name}/${name}.js`), 'utf8'), {
    Page(value) { definition = value }, require() { return store }, wx, Date,
    setTimeout(callback) { events.timers.push(callback) }, console: { error() {} }
  })
  const page = { ...definition, data: structuredClone(definition.data),
    setData(patch, callback) { Object.assign(this.data, patch); if (callback) callback() }
  }
  return { page, memory, events }
}

const draftKey = 'shiguang_cloud_publish_draft_v1'
const validDraft = { type: 'lost', title: '蓝色笔记本', category: '书籍文具',
  date: '2026-10-08', location: '图书馆', description: '蓝色封面，有课程笔记', contact: '微信：demo', image: '' }

test('恢复草稿时保留输入，入口类型可覆盖草稿类型', () => {
  const { page } = createPage('publish', {}, { [draftKey]: validDraft })
  page.onLoad({ type: 'found' })
  assert.equal(page.data.title, validDraft.title)
  assert.equal(page.data.type, 'found')
  assert.equal(page.data.categoryIndex, 2)
  assert.equal(page.data.draftState, '已恢复上次草稿')
})

test('草稿仅保存表单字段，不保存 submitting 等界面状态', () => {
  const { page, memory } = createPage('publish')
  Object.assign(page.data, validDraft, { submitting: true })
  page.saveDraft()
  assert.equal(memory[draftKey].title, validDraft.title)
  assert.equal(memory[draftKey].submitting, undefined)
  assert.equal(memory[draftKey].categories, undefined)
})

test('发布请求未完成时重复点击只提交一次', async () => {
  let finish
  let calls = 0
  const { page, events, memory } = createPage('publish', {
    getUser: () => ({ nickname: '同学' }),
    add: () => { calls++; return new Promise((resolve) => { finish = resolve }) }
  }, { [draftKey]: validDraft })
  page.onLoad({})
  const pending = page.submit()
  await page.submit()
  assert.equal(calls, 1)
  assert.equal(page.data.submitting, true)
  finish({ id: 'cloud-item' })
  await pending
  assert.equal(page.data.submitting, false)
  assert.equal(memory[draftKey], undefined)
  assert.deepEqual(events.routes, ['/pages/success/success?id=cloud-item'])
})

test('发布失败保留草稿、不跳成功页，解除忙碌状态后能重试', async () => {
  let failed = true
  const { page, events, memory } = createPage('publish', {
    getUser: () => ({ nickname: '同学' }),
    add: async () => { if (failed) throw new Error('offline'); return { id: 'retry-item' } }
  }, { [draftKey]: validDraft })
  page.onLoad({})
  await page.submit()
  assert.equal(memory[draftKey].title, validDraft.title)
  assert.equal(page.data.submitting, false)
  assert.equal(events.routes.length, 0)
  assert.match(events.toasts[0].title, /发布失败/)
  failed = false
  await page.submit()
  assert.equal(events.routes[0], '/pages/success/success?id=retry-item')
})

test('未设置昵称的发布引导到资料页，取消引导不跳转', async () => {
  let calls = 0
  const { page, events } = createPage('publish', { getUser: () => null, add: () => { calls++ } })
  Object.assign(page.data, validDraft)
  await page.submit()
  assert.equal(calls, 0)
  events.modals[0].success({ confirm: false })
  assert.equal(events.routes.length, 0)
  events.modals[0].success({ confirm: true })
  assert.equal(events.routes[0], '/pages/login/login')
})

test('必填项空白或描述太短不发送云发布请求', async () => {
  for (const field of ['title', 'location', 'description', 'contact']) {
    let calls = 0
    const { page, events } = createPage('publish', {
      getUser: () => ({ nickname: '同学' }), add: () => { calls++ }
    })
    Object.assign(page.data, validDraft, { [field]: '  ' })
    await page.submit()
    assert.equal(calls, 0)
    assert.equal(page.data.submitting, false)
    assert.equal(events.toasts.length, 1)
  }
  const { page, events } = createPage('publish', { getUser: () => ({ nickname: '同学' }) })
  Object.assign(page.data, validDraft, { description: '蓝色本' })
  await page.submit()
  assert.match(events.toasts[0].title, /详细/)
})

test('昵称保存期间重复点击只写入一次', async () => {
  let finish
  let calls = 0
  const { page, events } = createPage('login', {
    setUser: () => { calls++; return new Promise((resolve) => { finish = resolve }) }
  })
  page.data.nickname = '  小林  '
  const pending = page.submit()
  const repeated = page.submit()
  assert.equal(calls, 1)
  finish({ nickname: '小林' })
  await Promise.all([pending, repeated])
  assert.equal(page.data.submitting, false)
  assert.equal(events.timers.length, 1)
  events.timers[0]()
  assert.deepEqual(events.routes, ['back'])
})

test('昵称空白或保存失败不返回上一页，之后可以重试', async () => {
  let calls = 0
  let failed = true
  const { page, events } = createPage('login', {
    setUser: async () => { calls++; if (failed) throw new Error('offline'); return { nickname: '小林' } }
  })
  page.data.nickname = '   '
  await page.submit()
  assert.equal(calls, 0)
  page.data.nickname = '小林'
  await page.submit()
  assert.equal(events.timers.length, 0)
  assert.equal(page.data.submitting, false)
  failed = false
  await page.submit()
  assert.equal(events.timers.length, 1)
})

test('首页关键词、类型与分类组合筛选，并可清空恢复', () => {
  const { page } = createPage('home')
  page.data.allItems = [
    { id: 'one', title: 'AirPods 耳机', description: '白色', location: '图书馆', category: '数码', type: 'lost' },
    { id: 'two', title: 'AirPods 耳机', description: '黑色', location: '图书馆', category: '数码', type: 'found' },
    { id: 'three', title: '笔记本', description: '蓝色', location: '食堂', category: '书籍文具', type: 'lost' }
  ]
  Object.assign(page.data, { query: '  AIRPODS  ', currentType: 'lost', currentCategory: '数码' })
  page.applyFilters()
  assert.deepEqual(Array.from(page.data.filteredItems, (item) => item.id), ['one'])
  page.resetFilters()
  assert.equal(page.data.filteredItems.length, 3)
  page.handleSearch({ detail: { value: '不存在的物品' } })
  assert.equal(page.data.filteredItems.length, 0)
})

test('首页请求失败保留上次列表，并结束刷新提示', async () => {
  const { page, events } = createPage('home', { getAll: async () => { throw new Error('offline') } })
  const previous = [{ id: 'old' }]
  page.data.allItems = previous
  await page.loadData()
  assert.equal(page.data.allItems, previous)
  assert.deepEqual(events.loading, ['start', 'stop', 'refresh-stop'])
  assert.match(events.toasts[0].title, /加载失败/)
})

test('我的发布统计和状态过滤保持一致', async () => {
  const { page } = createPage('my-posts', {
    getMine: async () => [{ id: 'open', status: 'open' }, { id: 'closed', status: 'closed' }]
  })
  await page.loadData()
  assert.equal(page.data.counts.all, 2)
  assert.equal(page.data.counts.open, 1)
  assert.equal(page.data.counts.closed, 1)
  page.changeStatus({ currentTarget: { dataset: { status: 'closed' } } })
  assert.deepEqual(Array.from(page.data.items, (item) => item.id), ['closed'])
})

test('取消删除或标记解决不调用服务端写入', () => {
  let writes = 0
  const { page, events } = createPage('my-posts', {
    remove: () => { writes++ }, update: () => { writes++ }
  })
  const event = { currentTarget: { dataset: { id: 'item' } } }
  page.deleteItem(event)
  page.markSolved(event)
  for (const modal of events.modals) modal.success({ confirm: false })
  assert.equal(writes, 0)
  assert.equal(events.toasts.length, 0)
})

test('首页和我的发布点击卡片只导航到指定详情', () => {
  for (const name of ['home', 'my-posts']) {
    const { page, events } = createPage(name)
    page.openDetail({ detail: { id: 'cloud-item' } })
    assert.deepEqual(events.routes, ['/pages/detail/detail?id=cloud-item'])
  }
})

test('个人中心统计来自当前账号云端数据，不信任本机资料缓存', async () => {
  const { page } = createPage('profile', {
    loadUser: async () => ({ nickname: 'B' }),
    getMine: async () => [{ status: 'open' }, { status: 'closed' }, { status: 'closed' }],
    getFavorites: async () => [{ id: 'favorite' }]
  })
  await page.refresh()
  assert.equal(page.data.user.nickname, 'B')
  assert.equal(page.data.stats.posts, 3)
  assert.equal(page.data.stats.open, 1)
  assert.equal(page.data.stats.solved, 2)
  assert.equal(page.data.stats.favorites, 1)
})
