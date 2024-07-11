# Next Outliner

一个类似 Workflowy 的大纲笔记软件，但加了一些我想要的功能，包括：

1. 代码块（使用 CodeMirror）
2. 所见即所得的行内与行间公式编辑（使用 MathLive）
3. 间隔重复（使用 ts-fsrs）
4. 问题还很多，但基本能用的多端同步与协同编辑（使用 Yjs）
5. 块属性（数字、文本、URL、块引用）
6. 多列布局

Workflowy 的大部分特性已经实现了，包括：

1. 基本大纲编辑，富文本，所见即所得
2. 模糊搜索（使用 minisearch）
3. 块引用
4. 镜像块，支持同步编辑
5. 文档块（隐藏 bullet，增加块上下间距）
6. 明暗两色主题

## 演示视频

https://github.com/Stardusten/next-outliner-frontend/assets/38722307/c5199b0e-acb9-4a43-abcf-166ee4a91eae

https://github.com/Stardusten/next-outliner-frontend/assets/38722307/3976a350-6c87-427a-9c13-218ee1aa78d1

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
