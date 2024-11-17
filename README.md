> 对整个架构和 UI 不太满意，已经重写了：https://github.com/Stardusten/next-outliner-frontend2

# Next Outliner

一个类似 Workflowy 的大纲笔记软件，但加了一些功能，包括：

1. 代码块（使用 CodeMirror）
2. 行内与行间公式编辑（使用 KaTeX）
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

- 查询语法
  ![image](https://github.com/user-attachments/assets/66700a66-239d-46d7-b17b-642dc9d6f805)
- 块属性
  ![image](https://github.com/user-attachments/assets/b7161463-9437-42aa-91c6-e42ce95ab663)
- 数学公式与反链面板
  ![image](https://github.com/user-attachments/assets/9154cd46-b369-4986-92a7-41d2da7249dd)
- 分栏与浮动编辑菜单
  ![image](https://github.com/user-attachments/assets/85682bfe-6fb6-4425-b62f-f20a24139901)


