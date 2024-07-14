# Next Outliner

一个类似 Workflowy 的大纲笔记软件，但加了一些功能，包括：

1. 代码块（使用 CodeMirror）
2. 所见即所得的行内与行间公式编辑（使用 MathLive）
3. 间隔重复（使用 ts-fsrs）
4. 块属性（数字、文本、URL、块引用）

Workflowy 的大部分特性已经实现了，包括：

1. 基本的大纲编辑（折叠、聚焦、缩进 / 反缩进，拖拽选中块等）
2. 块内使用富文本编辑（基于 ProseMirror）
3. 模糊搜索（使用 minisearch 在前端实现）
4. 问题还很多，但基本能用的多端同步与协同编辑（使用 Yjs）
5. 块引用
6. 镜像块，与原身保持同步
7. 文档块（隐藏 bullet，增加块上下间距）
8. 自带明暗两色主题

## 使用截图

![image](https://github.com/user-attachments/assets/0c93b6de-c43f-4b9b-969f-6c6e23bce357)

![image](https://github.com/user-attachments/assets/8e206bc7-9264-4707-b407-61fcf7b0832f)

![image](https://github.com/user-attachments/assets/7ad039ab-8fc0-49c6-991d-504c58b8d5cb)


## 安装说明

懒得打包，想尝试的直接在 dev 下用吧。

```bash
mkdir next-memo
cd next-memo
mkdir testdb # 创建库，所有笔记数据都存在这个下面
cd ..
git clone git@github.com:Stardusten/next-outliner-backend.git # 把后端拉下来
git clone git@github.com:Stardusten/next-outliner-frontend.git # 把前端拉下来
cd next-outliner-backend
pnpm i # 安装依赖
pnpm run dev # 启动后端
cd ..
cd next-outliner-frontend
pnpm i # 安装依赖
pnpm run dev # 启动前端
```
