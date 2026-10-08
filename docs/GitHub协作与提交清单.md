# GitHub 协作与提交清单

以下步骤需要使用你和队友各自的 GitHub 账号完成，不能用同一个账号代替。

## 仓库创建者

1. 在 GitHub 新建仓库，名称建议为 `shiguang-lost-and-found`。
2. 将本地仓库推送到 GitHub。
3. 邀请或告知队友 Fork 仓库。
4. 在博客开头填写仓库链接。

```bash
git remote add origin <你的仓库地址>
git branch -M main
git push -u origin main
```

## 另一位成员

1. 在 GitHub 点击 Fork。
2. 克隆自己的 Fork。
3. 新建功能分支并完成真实修改。
4. 提交并推送分支。
5. 向原仓库发起 Pull Request。

```bash
git checkout -b feature/<功能名称>
git add .
git commit -m "feat: <实际完成的功能>"
git push -u origin feature/<功能名称>
```

## 提交前检查

- [ ] 两人的博客链接互相指向对方
- [ ] 两人的博客都包含 GitHub 仓库地址
- [ ] 队友确实通过 Fork 和 Pull Request 参与
- [ ] 提交信息能够说明修改内容
- [ ] README 中的分工与提交记录一致
- [ ] 博客附上 commit 记录截图和 PR 截图
- [ ] `npm test` 全部通过
- [ ] 微信开发者工具能够正常编译和预览
- [ ] PSP、流程图、测试说明、问题总结和结对评价已填写
