const test = require('node:test')
const assert = require('node:assert/strict')

const memory = Object.create(null)
const calls = []
const deletedFiles = []
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
    async deleteFile({ fileList }) { deletedFiles.push(...fileList) }
  }
}

const store = require('../utils/store')

test.beforeEach(() => {
  calls.length = 0
  deletedFiles.length = 0
  Object.keys(memory).forEach((key) => delete memory[key])
  handler = async ({ data }) => ({ result: { ok: true, data: data.action === 'getAll' ? [] : null } })
  wx.cloud.uploadFile = async ({ cloudPath, filePath }) => {
    calls.push({ upload: { cloudPath, filePath } })
    return { fileID: 'cloud://demo/listings/photo.jpg' }
  }
  wx.cloud.deleteFile = async ({ fileList }) => { deletedFiles.push(...fileList) }
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

test('首次初始化网络失败后，再次读取会重试初始化而不是永久卡死', async () => {
  handler = async () => { throw new Error('network unavailable') }
  await assert.rejects(() => store.init(), /network/)
  handler = async ({ data }) => ({ result: { ok: true,
    data: data.action === 'bootstrap' ? { seeded: false } : { id: 'retry-item' }
  } })
  const result = await store.getById('retry-item')
  assert.equal(result.id, 'retry-item')
  assert.deepEqual(calls.map((call) => call.data.action), ['bootstrap', 'bootstrap', 'getById'])
})

test('无照片发布不调用上传，且不提交伪造归属或状态字段', async () => {
  handler = async ({ data }) => ({ result: { ok: true, data: { id: 'item', ...data.payload } } })
  await store.add({ title: '钥匙', image: '', ownerOpenId: 'bob', mine: true, status: 'closed' })
  assert.equal(calls.filter((call) => call.upload).length, 0)
  const payload = calls.find((call) => call.data).data.payload
  assert.equal(payload.ownerOpenId, undefined)
  assert.equal(payload.mine, undefined)
  assert.equal(payload.status, undefined)
})

test('上传失败时不发发布请求，也不删除原本地照片', async () => {
  wx.cloud.uploadFile = async () => { throw new Error('upload failed') }
  await assert.rejects(() => store.add({ title: '钥匙', image: 'wxfile://tmp/keys.jpg' }), /upload failed/)
  assert.equal(calls.length, 0)
  assert.equal(deletedFiles.length, 0)
})

test('服务端明确拒绝发布时清理本次新上传的照片', async () => {
  handler = async () => ({ result: { ok: false, message: '请完整填写发布信息' } })
  await assert.rejects(() => store.add({ title: '', image: 'wxfile://tmp/keys.jpg' }), /完整填写/)
  assert.deepEqual(deletedFiles, ['cloud://demo/listings/photo.jpg'])
})

test('发布失败不会删除传入的已有云文件', async () => {
  handler = async () => ({ result: { ok: false, message: '请完整填写发布信息' } })
  await assert.rejects(() => store.add({ image: 'cloud://demo/listings/existing.jpg' }), /完整填写/)
  assert.equal(deletedFiles.length, 0)
})

test('图片清理失败不掩盖最初的发布失败原因', async () => {
  handler = async () => ({ result: { ok: false, message: '请完整填写发布信息' } })
  wx.cloud.deleteFile = async () => { throw new Error('cleanup failed') }
  await assert.rejects(() => store.add({ image: 'wxfile://tmp/photo.jpg' }), /完整填写/)
})

test('照片扩展名大小写和带参数路径可处理，无扩展名默认为 jpg', async () => {
  for (const [localPath, extension] of [['wxfile://tmp/photo.PNG?x=1', 'png'], ['wxfile://tmp/photo', 'jpg']]) {
    calls.length = 0
    await store.uploadFile(localPath)
    assert.match(calls[0].upload.cloudPath, new RegExp(`^listings/\\d{8}/.+\\.${extension}$`))
    assert.equal(calls[0].upload.filePath, localPath)
  }
})

test('云函数返回缺失或异常响应时抛出统一错误', async () => {
  for (const response of [undefined, {}, { result: null }, { result: { ok: 'true' } }]) {
    handler = async () => response
    await assert.rejects(() => store.getAll(), /云服务暂时不可用/)
  }
})

test('网络错误不被误当作空列表', async () => {
  handler = async () => { throw new Error('offline') }
  await assert.rejects(() => store.getAll(), /offline/)
})

test('云端明确没有资料时清除旧缓存，读取故障则保留缓存', async () => {
  const cached = { nickname: '旧昵称' }
  memory.shiguang_cloud_user_v1 = cached
  handler = async () => { throw new Error('offline') }
  await assert.rejects(() => store.loadUser(), /offline/)
  assert.equal(store.getUser(), cached)
  handler = async () => ({ result: { ok: true, data: null } })
  assert.equal(await store.loadUser(), null)
  assert.equal(store.getUser(), null)
})

test('昵称保存失败不会把未保存的昵称写入缓存', async () => {
  memory.shiguang_cloud_user_v1 = { nickname: '原昵称' }
  handler = async () => ({ result: { ok: false, message: '保存失败' } })
  await assert.rejects(() => store.setUser({ nickname: '新昵称' }), /保存失败/)
  assert.equal(store.getUser().nickname, '原昵称')
})

test('清除本机用户缓存不发送删除云端身份或资料请求', () => {
  memory.shiguang_cloud_user_v1 = { nickname: '小林' }
  store.logout()
  assert.equal(store.getUser(), null)
  assert.equal(calls.length, 0)
})

test('初始化期间并发读取等初始化成功后才发请求', async () => {
  let resolveBootstrap
  handler = async ({ data }) => data.action === 'bootstrap'
    ? new Promise((resolve) => { resolveBootstrap = resolve })
    : { result: { ok: true, data: [] } }
  const init = store.init()
  const all = store.getAll()
  const mine = store.getMine()
  assert.deepEqual(calls.map((call) => call.data.action), ['bootstrap'])
  resolveBootstrap({ result: { ok: true, data: { seeded: false } } })
  await Promise.all([init, all, mine])
  assert.deepEqual(calls.map((call) => call.data.action), ['bootstrap', 'getAll', 'getMine'])
})
