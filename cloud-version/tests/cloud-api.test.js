const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

// 独立内存数据库：测试生产云函数逻辑，不向真实云端写入数据。
function createApi(openId = 'alice') {
  let currentOpenId = openId
  let failImages = false
  const imageCalls = []
  const deletedFiles = []
  const failures = new Map()
  let imageResult
  function checkFailure(name, operation) {
    if (failures.has(`${name}.${operation}`)) throw failures.get(`${name}.${operation}`)
  }
  const tables = { items: new Map(), users: new Map(), favorites: new Map(), reports: new Map() }
  let sequence = 0
  function collection(name) {
    const table = tables[name]
    const query = (filter = {}) => ({
      limit() { return this },
      async get() {
        checkFailure(name, 'get')
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
            checkFailure(name, 'get')
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
  const cloud = {
    init() {}, database: () => db, getWXContext: () => ({ OPENID: currentOpenId }),
    async deleteFile({ fileList }) {
      deletedFiles.push(...fileList)
      checkFailure('storage', 'delete')
    },
    async getTempFileURL({ fileList }) {
      imageCalls.push(fileList)
      if (failImages) throw new Error('storage unavailable')
      if (imageResult) return imageResult(fileList)
      return { fileList: fileList.map(({ fileID }) => ({
        fileID, status: 0, tempFileURL: `https://signed.example/${currentOpenId}/${encodeURIComponent(fileID)}`
      })) }
    }
  }
  const exports = {}
  const source = fs.readFileSync(path.join(__dirname, '../cloudfunctions/shiguangApi/index.js'), 'utf8')
  vm.runInNewContext(source, {
    exports, require: (name) => {
      assert.equal(name, 'wx-server-sdk')
      return cloud
    },
    console: { error() {} }, Date
  })
  return { invoke: exports.main, tables, imageCalls, deletedFiles,
    setOpenId(value) { currentOpenId = value },
    failImages() { failImages = true },
    fail(name, operation, message = 'database unavailable') {
      failures.set(`${name}.${operation}`, new Error(message))
    },
    setImageResult(handler) { imageResult = handler }
  }
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

test('A 发布的云端照片由服务端为 B 获取可显示链接，数据库只存文件 ID', async () => {
  const api = createApi('alice')
  const image = 'cloud://demo.bucket/listings/20261008/photo.jpg'
  const added = await api.invoke({ action: 'add', payload: { ...listing, image } })
  api.setOpenId('bob')
  const result = await api.invoke({ action: 'getById', id: added.data.id })
  assert.equal(result.ok, true)
  assert.equal(result.data.mine, false)
  assert.equal(result.data.image, image)
  assert.match(result.data.imageUrl, /^https:\/\/signed.example\/bob\//)
  assert.equal(api.tables.items.get(added.data.id).imageUrl, undefined)
  const list = await api.invoke({ action: 'getAll' })
  assert.equal(list.data[0].imageUrl, result.data.imageUrl)
  await api.invoke({ action: 'toggleFavorite', id: added.data.id })
  const favorites = await api.invoke({ action: 'getFavorites' })
  assert.equal(favorites.data[0].imageUrl, result.data.imageUrl)
})

test('图片服务失败时仍返回存在的物品，而不是信息已删除', async () => {
  const api = createApi()
  const added = await api.invoke({ action: 'add', payload: {
    ...listing, image: 'cloud://demo.bucket/listings/photo.jpg'
  } })
  api.failImages()
  const result = await api.invoke({ action: 'getById', id: added.data.id })
  assert.equal(result.ok, true)
  assert.equal(result.data.title, listing.title)
  assert.equal(result.data.imageUrl, '')
})

test('拒绝保存仅在 A 手机上有效的临时文件路径和非物品文件', async () => {
  const api = createApi()
  for (const image of ['wxfile://tmp/photo.jpg', 'http://tmp/photo.jpg', 'cloud://demo.bucket/private/secret.jpg']) {
    const result = await api.invoke({ action: 'add', payload: { ...listing, image } })
    assert.equal(result.ok, false)
    assert.match(result.message, /图片/)
  }
  assert.equal(api.tables.items.size, 0)
})

test('多张照片分批生成链接，单批不超过 50 张', async () => {
  const api = createApi()
  for (let index = 0; index < 51; index++) {
    api.tables.items.set(`item-${index}`, { ...listing, ownerOpenId: 'alice',
      image: `cloud://demo.bucket/listings/${index}.jpg` })
  }
  const result = await api.invoke({ action: 'getAll' })
  assert.equal(result.data.length, 51)
  assert.deepEqual(api.imageCalls.map((batch) => batch.length), [50, 1])
  assert.ok(result.data.every((item) => item.imageUrl.startsWith('https://')))
})

test('微信身份缺失时拒绝写入，即使客户端伪造 OPENID', async () => {
  const api = createApi()
  api.setOpenId(undefined)
  for (const event of [
    { action: 'add', payload: listing },
    { action: 'setProfile', profile: { nickname: '伪造用户' } },
    { action: 'report', id: 'item', reason: '测试' }
  ]) {
    const result = await api.invoke({ ...event, OPENID: 'alice' })
    assert.equal(result.ok, false)
    assert.match(result.message, /微信身份/)
  }
  assert.equal(api.tables.items.size, 0)
  assert.equal(api.tables.users.size, 0)
  assert.equal(api.tables.reports.size, 0)
})

test('空事件或未知操作返回可处理错误，不抛出未捕获异常', async () => {
  const api = createApi()
  for (const event of [undefined, null, {}, { action: 'not-an-action' }]) {
    const result = await api.invoke(event)
    assert.equal(result.ok, false)
    assert.match(result.message, /未知/)
  }
})

test('个人资料未设置返回空，但数据库故障必须返回错误', async () => {
  const api = createApi()
  assert.equal((await api.invoke({ action: 'getProfile' })).data, null)
  api.fail('users', 'get')
  const result = await api.invoke({ action: 'getProfile' })
  assert.equal(result.ok, false)
  assert.match(result.message, /database unavailable/)
})

test('修改展示昵称不会转移归属，A 和 B 的个人资料隔离', async () => {
  const api = createApi()
  await api.invoke({ action: 'setProfile', profile: { nickname: '  同一个昵称  ', ownerOpenId: 'bob' } })
  const added = await api.invoke({ action: 'add', payload: listing })
  assert.equal(added.data.owner, '同一个昵称')
  api.setOpenId('bob')
  assert.equal((await api.invoke({ action: 'getProfile' })).data, null)
  await api.invoke({ action: 'setProfile', profile: { nickname: '同一个昵称' } })
  assert.equal((await api.invoke({ action: 'getMine' })).data.length, 0)
  assert.equal((await api.invoke({ action: 'update', id: added.data.id, patch: { status: 'closed' } })).ok, false)
  assert.equal(api.tables.users.size, 2)
  api.setOpenId('alice')
  await api.invoke({ action: 'setProfile', profile: { nickname: '新昵称' } })
  assert.equal((await api.invoke({ action: 'getMine' })).data[0].id, added.data.id)
})

test('昵称空白被拒绝、超长昵称截断，未写入客户端账号密码', async () => {
  const api = createApi()
  const rejected = await api.invoke({ action: 'setProfile', profile: { nickname: '  ' } })
  assert.equal(rejected.ok, false)
  assert.equal(api.tables.users.size, 0)
  const saved = await api.invoke({ action: 'setProfile', profile: {
    nickname: '林'.repeat(25), account: 'fake-account', password: 'fake-password'
  } })
  assert.equal(saved.data.nickname.length, 20)
  assert.equal(api.tables.users.get('alice').password, undefined)
  assert.equal(api.tables.users.get('alice').account, undefined)
})

test('长文本按服务端边界截断，原始输入不被修改', async () => {
  const api = createApi()
  const payload = { ...listing, title: '物'.repeat(30), description: '描'.repeat(350),
    location: '地'.repeat(80), contact: '联'.repeat(100) }
  const result = await api.invoke({ action: 'add', payload })
  assert.equal(result.ok, true)
  for (const [field, length] of [['title', 24], ['description', 300], ['location', 60], ['contact', 80]]) {
    assert.equal(result.data[field].length, length)
  }
  assert.equal(payload.title.length, 30)
})

test('不支持的状态和客户端额外字段不能覆盖物品信息', async () => {
  const api = createApi()
  const added = await api.invoke({ action: 'add', payload: listing })
  for (const status of ['', null, 'deleted', 'picked-up']) {
    assert.equal((await api.invoke({ action: 'update', id: added.data.id, patch: { status } })).ok, false)
    assert.equal(api.tables.items.get(added.data.id).status, 'open')
  }
  const updated = await api.invoke({ action: 'update', id: added.data.id,
    patch: { status: 'closed', title: '篡改标题', ownerOpenId: 'bob', contact: '篡改联系方式' } })
  assert.equal(updated.ok, true)
  assert.equal(updated.data.title, listing.title)
  assert.equal(updated.data.contact, listing.contact)
  assert.equal(api.tables.items.get(added.data.id).ownerOpenId, 'alice')
})

test('详情查询数据库或收藏服务失败不被误报为不存在', async () => {
  for (const table of ['items', 'favorites']) {
    const api = createApi()
    api.tables.items.set('item', { ...listing, ownerOpenId: 'alice' })
    api.fail(table, 'get')
    const result = await api.invoke({ action: 'getById', id: 'item' })
    assert.equal(result.ok, false)
    assert.match(result.message, /database unavailable/)
  }
})

test('本人删除后清理所有账号的关联收藏和云照片', async () => {
  const api = createApi()
  const image = 'cloud://demo.bucket/listings/deleted.jpg'
  const added = await api.invoke({ action: 'add', payload: { ...listing, image } })
  for (const user of ['alice', 'bob']) {
    api.tables.favorites.set(user, { userOpenId: user, itemId: added.data.id })
  }
  api.tables.favorites.set('unrelated', { userOpenId: 'bob', itemId: 'other-item' })
  const result = await api.invoke({ action: 'remove', id: added.data.id })
  assert.equal(result.ok, true)
  assert.equal(api.tables.items.has(added.data.id), false)
  assert.deepEqual([...api.tables.favorites.keys()], ['unrelated'])
  assert.deepEqual(api.deletedFiles, [image])
  assert.equal((await api.invoke({ action: 'getById', id: added.data.id })).data, null)
})

test('云照片清理失败不让已经完成的物品删除被误报失败', async () => {
  const api = createApi()
  const added = await api.invoke({ action: 'add', payload: { ...listing,
    image: 'cloud://demo.bucket/listings/photo.jpg' } })
  api.fail('storage', 'delete', 'storage unavailable')
  assert.equal((await api.invoke({ action: 'remove', id: added.data.id })).ok, true)
  assert.equal(api.tables.items.size, 0)
})

test('其他账号删除被拒绝，也不能清理原发布者的云照片', async () => {
  const api = createApi()
  const added = await api.invoke({ action: 'add', payload: { ...listing,
    image: 'cloud://demo.bucket/listings/private-owner.jpg' } })
  api.setOpenId('bob')
  assert.equal((await api.invoke({ action: 'remove', id: added.data.id })).ok, false)
  assert.equal(api.deletedFiles.length, 0)
  assert.equal(api.tables.items.size, 1)
})

test('收藏不存在的物品被拒绝，已有失效收藏不使列表报错', async () => {
  const api = createApi()
  const rejected = await api.invoke({ action: 'toggleFavorite', id: 'gone' })
  assert.equal(rejected.ok, false)
  assert.equal(api.tables.favorites.size, 0)
  api.tables.favorites.set('stale', { userOpenId: 'alice', itemId: 'gone' })
  const result = await api.invoke({ action: 'getFavorites' })
  assert.equal(result.ok, true)
  assert.equal(result.data.length, 0)
})

test('重复引用同一照片只签名一次，非物品云文件不签名', async () => {
  const api = createApi()
  for (const id of ['one', 'two']) api.tables.items.set(id, { ...listing,
    image: 'cloud://demo.bucket/listings/shared.jpg', ownerOpenId: 'alice' })
  api.tables.items.set('private', { ...listing, image: 'cloud://demo.bucket/private/secret.jpg' })
  const result = await api.invoke({ action: 'getAll' })
  assert.equal(api.imageCalls.length, 1)
  assert.equal(api.imageCalls[0].length, 1)
  assert.equal(result.data.find((item) => item.id === 'private').imageUrl, '')
  assert.equal(result.data.find((item) => item.id === 'one').imageUrl,
    result.data.find((item) => item.id === 'two').imageUrl)
})

test('部分照片签名失败只影响对应照片，不接受失败状态中的链接', async () => {
  const api = createApi()
  for (const id of ['good', 'bad']) api.tables.items.set(id, { ...listing,
    image: `cloud://demo.bucket/listings/${id}.jpg` })
  api.setImageResult((fileList) => ({ fileList: fileList.map(({ fileID }) => ({
    fileID, status: fileID.includes('bad') ? -1 : 0, tempFileURL: 'https://signed.example/photo'
  })) }))
  const result = await api.invoke({ action: 'getAll' })
  assert.equal(result.ok, true)
  assert.equal(result.data.length, 2)
  assert.equal(result.data.find((item) => item.id === 'bad').imageUrl, '')
  assert.equal(result.data.find((item) => item.id === 'good').imageUrl, 'https://signed.example/photo')
})

test('示例信息不属于任何真实账号，不能被普通用户改状态', async () => {
  const api = createApi()
  await api.invoke({ action: 'bootstrap' })
  assert.equal((await api.invoke({ action: 'getMine' })).data.length, 0)
  const result = await api.invoke({ action: 'update', id: 'seed-1', patch: { status: 'closed' } })
  assert.equal(result.ok, false)
  assert.equal(api.tables.items.get('seed-1').status, 'open')
})

test('列表按发布时间倒序排列，并隐藏内部归属和时间字段', async () => {
  const api = createApi()
  for (const [id, date] of [['old', '2026-01-01'], ['new', '2026-10-08']]) {
    api.tables.items.set(id, { ...listing, ownerOpenId: 'alice', createdAtTs: new Date(date) })
  }
  const result = await api.invoke({ action: 'getAll' })
  assert.deepEqual(result.data.map((item) => item.id), ['new', 'old'])
  for (const item of result.data) {
    assert.equal(item._id, undefined)
    assert.equal(item.ownerOpenId, undefined)
    assert.equal(item.createdAtTs, undefined)
  }
})

test('反馈拒绝空内容且报告者不能由客户端伪造', async () => {
  const api = createApi()
  for (const event of [{ id: '', reason: '失效' }, { id: 'item', reason: '  ' }]) {
    assert.equal((await api.invoke({ action: 'report', ...event })).ok, false)
  }
  assert.equal(api.tables.reports.size, 0)
  const result = await api.invoke({ action: 'report', id: 'item', reason: '  信息失效  ', reporterOpenId: 'bob' })
  assert.equal(result.ok, true)
  const report = [...api.tables.reports.values()][0]
  assert.equal(report.reporterOpenId, 'alice')
  assert.equal(report.reason, '信息失效')
})
