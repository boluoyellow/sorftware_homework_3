const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

// 独立内存数据库：测试生产云函数逻辑，不向真实云端写入数据。
function createApi(openId = 'alice') {
  const tables = { items: new Map(), users: new Map(), favorites: new Map(), reports: new Map() }
  let sequence = 0
  function collection(name) {
    const table = tables[name]
    const query = (filter = {}) => ({
      limit() { return this },
      async get() {
        return { data: [...table].filter(([id, value]) => Object.entries(filter).every(([key, expected]) => {
          const actual = key === '_id' ? id : value[key]
          return expected && expected.in ? expected.in.includes(actual) : actual === expected
        })).map(([id, value]) => ({ ...value, _id: id })) }
      },
      async remove() {
        const { data } = await this.get()
        data.forEach((value) => table.delete(value._id))
      }
    })
    return {
      ...query(),
      where: query,
      doc(id) {
        return {
          async get() {
            if (!table.has(id)) throw new Error('document does not exist')
            return { data: { ...table.get(id), _id: id } }
          },
          async set({ data }) { table.set(id, { ...data }) },
          async update({ data }) { table.set(id, { ...table.get(id), ...data }) },
          async remove() { table.delete(id) }
        }
      },
      async add({ data }) {
        const id = `test-${++sequence}`
        table.set(id, { ...data })
        return { _id: id }
      }
    }
  }
  const db = { collection, command: { in: (ids) => ({ in: ids }) }, serverDate: () => new Date() }
  const cloud = { init() {}, database: () => db, getWXContext: () => ({ OPENID: openId }), deleteFile: async () => {} }
  const exports = {}
  const source = fs.readFileSync(path.join(__dirname, '../cloudfunctions/shiguangApi/index.js'), 'utf8')
  vm.runInNewContext(source, {
    exports, require: (name) => {
      assert.equal(name, 'wx-server-sdk')
      return cloud
    },
    console: { error() {} }, Date
  })
  return { invoke: exports.main, tables }
}

const listing = {
  type: 'lost', title: '蓝色笔记本', category: '书籍文具',
  description: '蓝色封面，第一页有课程笔记。', location: '图书馆',
  date: '2026-10-08', contact: '仅自动测试', image: ''
}

test('云端发布寻物和招领均为进行中，忽略客户端伪造的状态和归属', async () => {
  const api = createApi()
  for (const type of ['lost', 'found']) {
    const result = await api.invoke({ action: 'add', OPENID: 'mallory', payload: {
      ...listing, type, status: 'closed', ownerOpenId: 'mallory'
    } })
    assert.equal(result.ok, true)
    assert.equal(result.data.status, 'open')
    assert.equal(result.data.type, type)
    assert.equal(result.data.mine, true)
    assert.equal(api.tables.items.get(result.data.id).ownerOpenId, 'alice')
    assert.equal(result.data.ownerOpenId, undefined)
  }
})

test('本人可以结束和重新开启信息', async () => {
  const api = createApi()
  const added = await api.invoke({ action: 'add', payload: listing })
  for (const status of ['closed', 'open']) {
    const result = await api.invoke({ action: 'update', id: added.data.id, patch: { status } })
    assert.equal(result.ok, true)
    assert.equal(result.data.status, status)
  }
})

test('不能修改或删除其他发布者的信息', async () => {
  const api = createApi()
  api.tables.items.set('bob-item', { ...listing, ownerOpenId: 'bob', status: 'open' })
  for (const action of ['update', 'remove']) {
    const result = await api.invoke({ action, id: 'bob-item', patch: { status: 'closed' } })
    assert.equal(result.ok, false)
    assert.match(result.message, /只能/)
    assert.equal(api.tables.items.get('bob-item').status, 'open')
  }
})

test('云端拒绝缺失必填字段的发布', async () => {
  const api = createApi()
  for (const field of ['title', 'description', 'location', 'contact']) {
    const result = await api.invoke({ action: 'add', payload: { ...listing, [field]: '  ' } })
    assert.equal(result.ok, false)
  }
  assert.equal(api.tables.items.size, 0)
})

test('收藏与其他用户隔离，并支持取消收藏', async () => {
  const api = createApi()
  const added = await api.invoke({ action: 'add', payload: listing })
  const id = added.data.id
  api.tables.favorites.set('bob-favorite', { userOpenId: 'bob', itemId: id })
  assert.equal((await api.invoke({ action: 'getFavorites' })).data.length, 0)
  assert.equal((await api.invoke({ action: 'toggleFavorite', id })).data.favorite, true)
  assert.equal((await api.invoke({ action: 'getFavorites' })).data.length, 1)
  assert.equal((await api.invoke({ action: 'toggleFavorite', id })).data.favorite, false)
  assert.equal(api.tables.favorites.has('bob-favorite'), true)
})

test('示例初始化可重复调用而不重复写入', async () => {
  const api = createApi()
  assert.equal((await api.invoke({ action: 'bootstrap' })).data.seeded, true)
  assert.equal((await api.invoke({ action: 'bootstrap' })).data.seeded, false)
  assert.equal(api.tables.items.size, 5)
})

test('已删除或不存在的信息返回空结果', async () => {
  const api = createApi()
  const result = await api.invoke({ action: 'getById', id: 'missing' })
  assert.equal(result.ok, true)
  assert.equal(result.data, null)
})
