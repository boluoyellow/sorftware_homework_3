const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const command = db.command
const ITEMS = 'items'
const USERS = 'users'
const FAVORITES = 'favorites'
const REPORTS = 'reports'

const seedListings = [
  {
    seedKey: 'seed-1', type: 'lost', title: '白色无线耳机', category: '数码',
    description: '白色充电盒，右侧有一枚小小的蓝色星星贴纸。可能落在图书馆三楼靠窗的位置。',
    location: '图书馆三楼', date: '2026-09-27', contact: '微信：sunny_0927', status: 'open',
    owner: '林小满', createdAt: '2026-09-27 18:20', createdAtTs: new Date('2026-09-27T18:20:00+08:00'),
    emoji: '🎧', gradient: 'linear-gradient(135deg, #ffe8a3 0%, #ffc95b 100%)'
  },
  {
    seedKey: 'seed-2', type: 'found', title: '一串宿舍钥匙', category: '证件钥匙',
    description: '黑色钥匙圈，共三把钥匙，挂有一只绿色小恐龙。已交到一食堂服务台。',
    location: '第一食堂门口', date: '2026-09-28', contact: '手机：138****6217', status: 'open',
    owner: '陈同学', createdAt: '2026-09-28 09:40', createdAtTs: new Date('2026-09-28T09:40:00+08:00'),
    emoji: '🔑', gradient: 'linear-gradient(135deg, #d9f4e9 0%, #99d7bf 100%)'
  },
  {
    seedKey: 'seed-3', type: 'lost', title: '蓝色校园卡', category: '证件钥匙',
    description: '卡套是透明的，卡背面贴着课程表，姓名已做隐私处理。',
    location: '知行楼 B203', date: '2026-09-26', contact: 'QQ：2486****19', status: 'open',
    owner: '周同学', createdAt: '2026-09-26 16:05', createdAtTs: new Date('2026-09-26T16:05:00+08:00'),
    emoji: '🪪', gradient: 'linear-gradient(135deg, #dceaff 0%, #9cbef2 100%)'
  },
  {
    seedKey: 'seed-4', type: 'found', title: '黑色折叠伞', category: '生活用品',
    description: '伞柄上有白色字母，下午在体育馆看台下捡到。',
    location: '体育馆西看台', date: '2026-09-25', contact: '微信：playground_8', status: 'closed',
    owner: '拾光志愿者', createdAt: '2026-09-25 20:10', createdAtTs: new Date('2026-09-25T20:10:00+08:00'),
    emoji: '☂️', gradient: 'linear-gradient(135deg, #e8e6f8 0%, #bbb6e6 100%)'
  },
  {
    seedKey: 'seed-5', type: 'found', title: '高等数学笔记本', category: '书籍文具',
    description: '牛皮纸封面，第一页写有 23 级软件工程，字迹很工整。',
    location: '博学楼 401', date: '2026-09-24', contact: 'QQ：1024****', status: 'open',
    owner: '王同学', createdAt: '2026-09-24 12:30', createdAtTs: new Date('2026-09-24T12:30:00+08:00'),
    emoji: '📒', gradient: 'linear-gradient(135deg, #fde0cb 0%, #f4ae77 100%)'
  }
]

function formatDateTime(date) {
  const chinaTime = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const pad = (value) => String(value).padStart(2, '0')
  return `${chinaTime.getUTCFullYear()}-${pad(chinaTime.getUTCMonth() + 1)}-${pad(chinaTime.getUTCDate())} ${pad(chinaTime.getUTCHours())}:${pad(chinaTime.getUTCMinutes())}`
}

function categoryEmoji(category) {
  return {
    '数码': '🎧', '证件钥匙': '🔑', '书籍文具': '📚',
    '生活用品': '🧢', '衣物饰品': '🧣', '其他': '📦'
  }[category] || '📦'
}

function categoryGradient(category) {
  return {
    '数码': 'linear-gradient(135deg, #ffe8a3 0%, #ffc95b 100%)',
    '证件钥匙': 'linear-gradient(135deg, #dceaff 0%, #9cbef2 100%)',
    '书籍文具': 'linear-gradient(135deg, #fde0cb 0%, #f4ae77 100%)',
    '生活用品': 'linear-gradient(135deg, #d9f4e9 0%, #99d7bf 100%)',
    '衣物饰品': 'linear-gradient(135deg, #f5dded 0%, #dba4ca 100%)',
    '其他': 'linear-gradient(135deg, #e8e6f8 0%, #bbb6e6 100%)'
  }[category] || 'linear-gradient(135deg, #e8e6f8 0%, #bbb6e6 100%)'
}

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength)
}

function normalizeItem(document, openId, favoriteIds = new Set()) {
  const item = { ...document }
  item.id = item._id
  item.mine = item.ownerOpenId === openId
  item.favorite = favoriteIds.has(item._id)
  delete item._id
  delete item.ownerOpenId
  delete item.createdAtTs
  return item
}

function timestamp(value) {
  if (value instanceof Date) return value.getTime()
  const parsed = new Date(value || 0).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

// 只为已从数据库查出的物品照片签发链接，不接收任意文件 ID 的签名请求。
// 保留 image 作为稳定的云文件 ID；imageUrl 每次读取时刷新，不写回数据库。
async function withImageUrls(items) {
  const fileIds = [...new Set(items.map((item) => item.image).filter((fileId) =>
    typeof fileId === 'string' && /^cloud:\/\/[^/]+\/listings\//.test(fileId)
  ))]
  const urls = new Map()
  for (let offset = 0; offset < fileIds.length; offset += 50) {
    try {
      const result = await cloud.getTempFileURL({
        fileList: fileIds.slice(offset, offset + 50).map((fileID) => ({ fileID, maxAge: 3600 }))
      })
      for (const file of result.fileList || []) {
        if (file.tempFileURL && (!file.status || file.status === 0) && (!file.code || file.code === 'SUCCESS')) {
          urls.set(file.fileID, file.tempFileURL)
        }
      }
    } catch (error) {
      // 图片服务异常不能让一条存在的信息变成“不存在”。
      console.error('物品图片链接获取失败', error)
    }
  }
  return items.map((item) => ({
    ...item,
    imageUrl: urls.get(item.image) || (/^https:\/\//.test(item.image || '') ? item.image : '')
  }))
}

async function favoriteSet(openId) {
  const result = await db.collection(FAVORITES).where({ userOpenId: openId }).limit(100).get()
  return new Set(result.data.map((entry) => entry.itemId))
}

async function listItems(openId, query = {}) {
  const collection = db.collection(ITEMS)
  const source = Object.keys(query).length ? collection.where(query) : collection
  const [itemsResult, favorites] = await Promise.all([
    source.limit(100).get(),
    favoriteSet(openId)
  ])
  return withImageUrls(itemsResult.data
    .sort((left, right) => timestamp(right.createdAtTs) - timestamp(left.createdAtTs))
    .map((item) => normalizeItem(item, openId, favorites)))
}

async function getItem(openId, id) {
  if (!id) return null
  let document
  try {
    const result = await db.collection(ITEMS).doc(id).get()
    document = result.data
  } catch (error) {
    if (String(error.errMsg || error.message || '').includes('does not exist')) return null
    throw error
  }
  if (!document || !document._id) return null
  const favorites = await favoriteSet(openId)
  const [item] = await withImageUrls([normalizeItem(document, openId, favorites)])
  return item
}

async function bootstrap() {
  const existing = await db.collection(ITEMS).where({ source: 'seed' }).limit(1).get()
  if (existing.data.length) return { seeded: false }
  await Promise.all(seedListings.map((item) => {
    const { seedKey, ...data } = item
    return db.collection(ITEMS).doc(seedKey).set({
      data: { ...data, source: 'seed', ownerOpenId: '__seed__' }
    })
  }))
  return { seeded: true }
}

async function addItem(openId, payload) {
  const type = payload.type === 'found' ? 'found' : 'lost'
  const category = cleanText(payload.category, 20) || '其他'
  const title = cleanText(payload.title, 24)
  const description = cleanText(payload.description, 300)
  const location = cleanText(payload.location, 60)
  const contact = cleanText(payload.contact, 80)
  if (!title || !description || !location || !contact) throw new Error('请完整填写发布信息')
  const image = cleanText(payload.image, 500)
  if (image && !/^cloud:\/\/[^/]+\/listings\//.test(image)) {
    throw new Error('图片未正确上传，请重新选择图片')
  }

  let owner = '校园同学'
  try {
    const profile = await db.collection(USERS).doc(openId).get()
    owner = cleanText(profile.data.nickname, 20) || owner
  } catch (error) {
    // 未设置资料时使用默认名称。
  }

  const now = new Date()
  const result = await db.collection(ITEMS).add({
    data: {
      type, title, category, description, location,
      date: cleanText(payload.date, 10),
      contact,
      image,
      status: 'open',
      owner,
      ownerOpenId: openId,
      createdAt: formatDateTime(now),
      createdAtTs: db.serverDate(),
      emoji: categoryEmoji(category),
      gradient: categoryGradient(category),
      source: 'user'
    }
  })
  return getItem(openId, result._id)
}

async function updateItem(openId, id, patch) {
  const current = await db.collection(ITEMS).doc(id).get()
  if (current.data.ownerOpenId !== openId) throw new Error('只能修改自己发布的信息')
  const status = patch && patch.status
  if (!['open', 'closed'].includes(status)) throw new Error('不支持的状态')
  await db.collection(ITEMS).doc(id).update({ data: { status, updatedAtTs: db.serverDate() } })
  return getItem(openId, id)
}

async function removeItem(openId, id) {
  const current = await db.collection(ITEMS).doc(id).get()
  if (current.data.ownerOpenId !== openId) throw new Error('只能删除自己发布的信息')
  await Promise.all([
    db.collection(ITEMS).doc(id).remove(),
    db.collection(FAVORITES).where({ itemId: id }).remove()
  ])
  if (current.data.image && String(current.data.image).startsWith('cloud://')) {
    await cloud.deleteFile({ fileList: [current.data.image] }).catch(() => {})
  }
  return { id }
}

async function toggleFavorite(openId, id) {
  const item = await getItem(openId, id)
  if (!item) throw new Error('信息不存在或已删除')
  const result = await db.collection(FAVORITES).where({ userOpenId: openId, itemId: id }).limit(1).get()
  if (result.data.length) {
    await db.collection(FAVORITES).doc(result.data[0]._id).remove()
  } else {
    await db.collection(FAVORITES).add({ data: { userOpenId: openId, itemId: id, createdAtTs: db.serverDate() } })
  }
  return getItem(openId, id)
}

async function getFavorites(openId) {
  const favorites = await db.collection(FAVORITES).where({ userOpenId: openId }).limit(100).get()
  const ids = favorites.data
    .sort((left, right) => timestamp(right.createdAtTs) - timestamp(left.createdAtTs))
    .map((entry) => entry.itemId)
  if (!ids.length) return []
  const items = await db.collection(ITEMS).where({ _id: command.in(ids) }).limit(100).get()
  const byId = new Map(items.data.map((item) => [item._id, item]))
  const favoriteIds = new Set(ids)
  return withImageUrls(ids.map((id) => byId.get(id)).filter(Boolean).map((item) => normalizeItem(item, openId, favoriteIds)))
}

async function getProfile(openId) {
  try {
    const result = await db.collection(USERS).doc(openId).get()
    return {
      nickname: result.data.nickname,
      avatar: result.data.avatar || '',
      initial: (result.data.nickname || '同').slice(0, 1),
      account: '微信云端用户'
    }
  } catch (error) {
    if (String(error.errMsg || error.message || '').includes('does not exist')) return null
    throw error
  }
}

async function setProfile(openId, profile) {
  const nickname = cleanText(profile && profile.nickname, 20)
  if (!nickname) throw new Error('请填写昵称')
  await db.collection(USERS).doc(openId).set({
    data: {
      nickname,
      avatar: cleanText(profile && profile.avatar, 500),
      updatedAtTs: db.serverDate()
    }
  })
  return getProfile(openId)
}

async function reportItem(openId, id, reason) {
  const reasonText = cleanText(reason, 40)
  if (!id || !reasonText) throw new Error('反馈内容不完整')
  await db.collection(REPORTS).add({
    data: { itemId: id, reason: reasonText, reporterOpenId: openId, createdAtTs: db.serverDate() }
  })
  return { submitted: true }
}

exports.main = async (event) => {
  let action
  try {
    event = event || {}
    action = event.action
    const { OPENID } = cloud.getWXContext()
    if (typeof OPENID !== 'string' || !OPENID.trim()) throw new Error('无法识别微信身份，请重新打开小程序')
    let data
    if (action === 'bootstrap') data = await bootstrap()
    else if (action === 'getAll') data = await listItems(OPENID)
    else if (action === 'getById') data = await getItem(OPENID, event.id)
    else if (action === 'add') data = await addItem(OPENID, event.payload || {})
    else if (action === 'update') data = await updateItem(OPENID, event.id, event.patch || {})
    else if (action === 'remove') data = await removeItem(OPENID, event.id)
    else if (action === 'toggleFavorite') data = await toggleFavorite(OPENID, event.id)
    else if (action === 'getMine') data = await listItems(OPENID, { ownerOpenId: OPENID })
    else if (action === 'getFavorites') data = await getFavorites(OPENID)
    else if (action === 'getProfile') data = await getProfile(OPENID)
    else if (action === 'setProfile') data = await setProfile(OPENID, event.profile || {})
    else if (action === 'report') data = await reportItem(OPENID, event.id, event.reason)
    else throw new Error('未知的云服务操作')
    return { ok: true, data }
  } catch (error) {
    console.error(action, error)
    return { ok: false, message: error.message || '云服务执行失败' }
  }
}
