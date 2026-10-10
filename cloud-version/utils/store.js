const USER_KEY = 'shiguang_cloud_user_v1'
const FUNCTION_NAME = 'shiguangApi'

let readyPromise = Promise.resolve()

function unwrap(response) {
  const result = response && response.result
  if (!result || result.ok !== true) {
    throw new Error((result && result.message) || '云服务暂时不可用')
  }
  return result.data
}

async function invokeRaw(action, data = {}) {
  const response = await wx.cloud.callFunction({
    name: FUNCTION_NAME,
    data: { action, ...data }
  })
  return unwrap(response)
}

function init() {
  const pending = invokeRaw('bootstrap')
  readyPromise = pending
  pending.catch(() => {
    if (readyPromise === pending) readyPromise = null
  })
  return pending
}

async function request(action, data) {
  await (readyPromise || init())
  return invokeRaw(action, data)
}

function sanitizeListing(payload) {
  return {
    type: payload.type,
    title: String(payload.title || '').trim(),
    category: payload.category,
    description: String(payload.description || '').trim(),
    location: String(payload.location || '').trim(),
    date: payload.date,
    contact: String(payload.contact || '').trim(),
    image: payload.image || ''
  }
}

function isCloudFile(path) {
  return typeof path === 'string' && path.startsWith('cloud://')
}

function fileExtension(path) {
  const match = String(path || '').match(/\.([a-zA-Z0-9]+)(?:\?|$)/)
  return match ? match[1].toLowerCase() : 'jpg'
}

async function uploadFile(localPath, folder = 'listings') {
  if (!localPath || isCloudFile(localPath)) return localPath || ''
  const date = new Date()
  const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('')
  const cloudPath = `${folder}/${day}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${fileExtension(localPath)}`
  const result = await wx.cloud.uploadFile({ cloudPath, filePath: localPath })
  return result.fileID
}

async function getAll() {
  return request('getAll')
}

async function getById(id) {
  return request('getById', { id })
}

async function add(payload) {
  const item = sanitizeListing(payload)
  let uploadedImage = ''
  try {
    if (item.image && !isCloudFile(item.image)) {
      uploadedImage = await uploadFile(item.image)
      item.image = uploadedImage
    }
    return await request('add', { payload: item })
  } catch (error) {
    if (uploadedImage && wx.cloud.deleteFile) {
      wx.cloud.deleteFile({ fileList: [uploadedImage] }).catch(() => {})
    }
    throw error
  }
}

async function update(id, patch) {
  return request('update', { id, patch })
}

async function remove(id) {
  return request('remove', { id })
}

async function toggleFavorite(id) {
  return request('toggleFavorite', { id })
}

async function getMine() {
  return request('getMine')
}

async function getFavorites() {
  return request('getFavorites')
}

function getUser() {
  return wx.getStorageSync(USER_KEY) || null
}

async function loadUser() {
  const user = await request('getProfile')
  if (user) wx.setStorageSync(USER_KEY, user)
  else wx.removeStorageSync(USER_KEY)
  return user
}

async function setUser(user) {
  const saved = await request('setProfile', {
    profile: {
      nickname: String(user.nickname || '').trim(),
      avatar: user.avatar || ''
    }
  })
  wx.setStorageSync(USER_KEY, saved)
  return saved
}

function logout() {
  wx.removeStorageSync(USER_KEY)
}

async function report(id, reason) {
  return request('report', { id, reason })
}

module.exports = {
  init,
  getAll,
  getById,
  add,
  update,
  remove,
  toggleFavorite,
  getMine,
  getFavorites,
  getUser,
  loadUser,
  setUser,
  logout,
  report,
  uploadFile,
  sanitizeListing
}
