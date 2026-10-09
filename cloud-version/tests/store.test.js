const test = require('node:test')
const assert = require('node:assert/strict')

const memory = Object.create(null)
const calls = []
let handler = async ({ data }) => ({ result: { ok: true, data: data.action === 'getAll' ? [] : null } })

global.wx = {
  getStorageSync(key) {
    return memory[key]
  },
  setStorageSync(key, value) {
    memory[key] = value
  },
  removeStorageSync(key) {
    delete memory[key]
  },
  cloud: {
    callFunction(options) {
      calls.push(options)
      return handler(options)
    },
    async uploadFile({ cloudPath, filePath }) {
      calls.push({ upload: { cloudPath, filePath } })
      return { fileID: 'cloud://demo/listings/photo.jpg' }
    },
    async deleteFile() {}
  }
}

const store = require('../utils/store')

test.beforeEach(() => {
  calls.length = 0
  Object.keys(memory).forEach((key) => delete memory[key])
  handler = async ({ data }) => ({ result: { ok: true, data: data.action === 'getAll' ? [] : null } })
})

test('发布前会清理文本首尾空格', () => {
  const payload = store.sanitizeListing({
    type: 'lost', title: '  黑色双肩包  ', category: '生活用品',
    description: '  侧面有钥匙扣  ', location: '  图书馆一楼  ',
    date: '2026-10-08', contact: '  微信：test  ', image: ''
  })
  assert.equal(payload.title, '黑色双肩包')
  assert.equal(payload.location, '图书馆一楼')
  assert.equal(payload.contact, '微信：test')
})

test('列表通过云函数读取', async () => {
  handler = async () => ({ result: { ok: true, data: [{ id: 'cloud-1', title: '校园卡' }] } })
  const items = await store.getAll()
  assert.equal(items[0].id, 'cloud-1')
  assert.equal(calls[0].data.action, 'getAll')
})

test('带本地图片发布时先上传云存储', async () => {
  handler = async ({ data }) => ({ result: { ok: true, data: { id: 'cloud-2', image: data.payload.image } } })
  const item = await store.add({
    type: 'found', title: '雨伞', category: '生活用品', description: '黑色长柄雨伞',
    location: '教学楼', date: '2026-10-08', contact: '微信：demo', image: 'wxfile://tmp/photo.jpg'
  })
  assert.equal(item.image, 'cloud://demo/listings/photo.jpg')
  assert.ok(calls.some((call) => call.upload))
  assert.equal(calls.find((call) => call.data).data.action, 'add')
})

test('云存储图片不会重复上传', async () => {
  handler = async ({ data }) => ({ result: { ok: true, data: { id: 'cloud-3', image: data.payload.image } } })
  await store.add({
    type: 'lost', title: '耳机', category: '数码', description: '白色无线耳机',
    location: '图书馆', date: '2026-10-08', contact: 'QQ：10000', image: 'cloud://demo/photo.jpg'
  })
  assert.equal(calls.filter((call) => call.upload).length, 0)
})

test('保存的云端资料同步到本机缓存', async () => {
  const profile = { nickname: '小林', initial: '小', account: '微信云端用户', avatar: '' }
  handler = async () => ({ result: { ok: true, data: profile } })
  const saved = await store.setUser({ nickname: '小林', avatar: '' })
  assert.deepEqual(saved, profile)
  assert.deepEqual(store.getUser(), profile)
})

test('云函数返回失败时抛出可处理的错误', async () => {
  handler = async () => ({ result: { ok: false, message: '只能修改自己发布的信息' } })
  await assert.rejects(() => store.update('other-id', { status: 'closed' }), /只能修改/)
})
