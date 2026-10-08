const LIST_KEY = 'shiguang_listings_v1'
const USER_KEY = 'shiguang_user_v1'

const seedListings = [
  {
    id: 'seed-1',
    type: 'lost',
    title: '白色无线耳机',
    category: '数码',
    description: '白色充电盒，右侧有一枚小小的蓝色星星贴纸。可能落在图书馆三楼靠窗的位置。',
    location: '图书馆三楼',
    date: '2026-09-27',
    contact: '微信：sunny_0927',
    status: 'open',
    owner: '林小满',
    createdAt: '2026-09-27 18:20',
    emoji: '🎧',
    gradient: 'linear-gradient(135deg, #ffe8a3 0%, #ffc95b 100%)',
    favorite: false
  },
  {
    id: 'seed-2',
    type: 'found',
    title: '一串宿舍钥匙',
    category: '证件钥匙',
    description: '黑色钥匙圈，共三把钥匙，挂有一只绿色小恐龙。已交到一食堂服务台。',
    location: '第一食堂门口',
    date: '2026-09-28',
    contact: '手机：138****6217',
    status: 'open',
    owner: '陈同学',
    createdAt: '2026-09-28 09:40',
    emoji: '🔑',
    gradient: 'linear-gradient(135deg, #d9f4e9 0%, #99d7bf 100%)',
    favorite: true
  },
  {
    id: 'seed-3',
    type: 'lost',
    title: '蓝色校园卡',
    category: '证件钥匙',
    description: '卡套是透明的，卡背面贴着课程表，姓名已做隐私处理。',
    location: '知行楼 B203',
    date: '2026-09-26',
    contact: 'QQ：2486****19',
    status: 'open',
    owner: '周同学',
    createdAt: '2026-09-26 16:05',
    emoji: '🪪',
    gradient: 'linear-gradient(135deg, #dceaff 0%, #9cbef2 100%)',
    favorite: false
  },
  {
    id: 'seed-4',
    type: 'found',
    title: '黑色折叠伞',
    category: '生活用品',
    description: '伞柄上有白色字母，下午在体育馆看台下捡到。',
    location: '体育馆西看台',
    date: '2026-09-25',
    contact: '微信：playground_8',
    status: 'closed',
    owner: '拾光志愿者',
    createdAt: '2026-09-25 20:10',
    emoji: '☂️',
    gradient: 'linear-gradient(135deg, #e8e6f8 0%, #bbb6e6 100%)',
    favorite: false
  },
  {
    id: 'seed-5',
    type: 'found',
    title: '高等数学笔记本',
    category: '书籍文具',
    description: '牛皮纸封面，第一页写有 23 级软件工程，字迹很工整。',
    location: '博学楼 401',
    date: '2026-09-24',
    contact: 'QQ：1024****',
    status: 'open',
    owner: '王同学',
    createdAt: '2026-09-24 12:30',
    emoji: '📒',
    gradient: 'linear-gradient(135deg, #fde0cb 0%, #f4ae77 100%)',
    favorite: false
  }
]

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function bootstrap() {
  if (!wx.getStorageSync(LIST_KEY)) {
    wx.setStorageSync(LIST_KEY, clone(seedListings))
  }
}

function getAll() {
  bootstrap()
  return wx.getStorageSync(LIST_KEY) || []
}

function saveAll(list) {
  wx.setStorageSync(LIST_KEY, list)
  return list
}

function getById(id) {
  return getAll().find((item) => item.id === id)
}

function add(payload) {
  const list = getAll()
  const user = getUser()
  const now = new Date()
  const item = {
    id: `local-${now.getTime()}`,
    type: payload.type,
    title: payload.title.trim(),
    category: payload.category,
    description: payload.description.trim(),
    location: payload.location.trim(),
    date: payload.date,
    contact: payload.contact.trim(),
    status: 'open',
    owner: user ? user.nickname : '校园同学',
    createdAt: formatDateTime(now),
    emoji: payload.emoji || categoryEmoji(payload.category),
    gradient: categoryGradient(payload.category),
    image: payload.image || '',
    favorite: false,
    mine: true
  }
  saveAll([item, ...list])
  return item
}

function update(id, patch) {
  const list = getAll().map((item) => item.id === id ? { ...item, ...patch } : item)
  saveAll(list)
  return getById(id)
}

function remove(id) {
  saveAll(getAll().filter((item) => item.id !== id))
}

function toggleFavorite(id) {
  const item = getById(id)
  if (!item) return null
  return update(id, { favorite: !item.favorite })
}

function getMine() {
  return getAll().filter((item) => item.mine)
}

function getFavorites() {
  return getAll().filter((item) => item.favorite)
}

function getUser() {
  return wx.getStorageSync(USER_KEY) || null
}

function setUser(user) {
  wx.setStorageSync(USER_KEY, user)
  return user
}

function logout() {
  wx.removeStorageSync(USER_KEY)
}

function resetDemo() {
  wx.setStorageSync(LIST_KEY, clone(seedListings))
}

function formatDateTime(date) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function categoryEmoji(category) {
  return {
    '数码': '🎧',
    '证件钥匙': '🔑',
    '书籍文具': '📚',
    '生活用品': '🧢',
    '衣物饰品': '🧣',
    '其他': '📦'
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
  }[category]
}

module.exports = {
  bootstrap,
  getAll,
  getById,
  add,
  update,
  remove,
  toggleFavorite,
  getMine,
  getFavorites,
  getUser,
  setUser,
  logout,
  resetDemo,
  categoryEmoji
}
