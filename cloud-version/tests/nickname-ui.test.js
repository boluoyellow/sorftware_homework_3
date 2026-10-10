const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')
}

test('昵称设置页标题统一，明确不需要账号密码，保留原昵称保存流程', () => {
  const page = read('pages/login/login.wxml')
  const config = JSON.parse(read('pages/login/login.json'))
  assert.equal(config.navigationBarTitleText, '设置昵称')
  assert.match(page, /class="header-caption">设置昵称</)
  assert.match(page, /class="welcome-title">设置昵称</)
  assert.match(page, /不需要账号和密码/)
  assert.match(page, /bindtap="submit"/)
  assert.match(page, /bindinput="handleInput"/)
  assert.doesNotMatch(page, /安全登录|点击登录|设置云端身份/)
})

test('个人中心提供设置和修改昵称入口，不误导成账号登录', () => {
  const page = read('pages/profile/profile.wxml')
  assert.match(page, /class="username">设置昵称</)
  assert.match(page, /class="edit-button" bindtap="goLogin">修改昵称</)
  assert.doesNotMatch(page, /点击登录|安全登录/)
})
