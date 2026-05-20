# Ntodo

Ntodo 是一个桌面置顶任务便签。当前版本先完成桌面端核心体验：固定在屏幕右上角、始终置顶、快速添加任务、优先级排序、子项目、完成动画、鼓励提示和已完成记录。

## 直接打开

日常使用请打开快速启动版：

```text
release\win-unpacked\Ntodo.exe
```

也可以打开构建脚本生成的快捷方式：

```text
release\Ntodo-fast-start.lnk
```

不要优先使用旧的 `dist\Ntodo.exe`。它是 portable 单文件版本，每次启动都会先自解压，所以会明显更慢。

## 开发运行

```bash
npm install --cache .npm-cache
npm start
```

应用数据会保存在 Electron 的 `userData` 目录下，文件名为 `tasks.json`。

## 重新打包

```bash
npm run dist
```

构建脚本会自动：

- 生成 `assets\ntodo.png` 和 `assets\ntodo.ico` 图标。
- 使用项目内 `.cache` 目录作为 Electron / electron-builder 缓存。
- 输出快速启动版本到 `release\win-unpacked\Ntodo.exe`。
- 生成快捷方式 `release\Ntodo-fast-start.lnk`。

如果确实需要单文件 portable 版本，可以运行：

```bash
npm run dist:portable
```

如果需要 Windows 安装包，可以运行：

```bash
npm run dist:installer
```

安装包会输出到：

```text
installer\Ntodo-Setup-0.1.0.exe
```

## 当前功能

- 启动后窗口固定在当前屏幕右上角。
- 默认始终置顶，可用标题栏右侧的置顶按钮切换。
- 添加任务时可选择高、中、低优先级。
- 待完成任务自动按优先级提前排序，同优先级按创建时间排序。
- 每个任务可添加子项目并单独勾选。
- 勾选完成后显示删除线、渐隐消失，并显示一条鼓励提示。
- 已完成页保留完成时间、优先级和子项目完成情况。
- 截图添加入口会把选择的截图保存为一条高优先级“待整理”任务。

## 后续扩展点

- 截图识别：在 `src/main.js` 的截图 IPC 后接入 OCR 或多模态 AI，把截图内容解析成任务标题、子项目和优先级。
- 网络同步：把 `src/main.js` 里的 JSON 本地存储替换为本地缓存加远端 API，同步任务、完成记录和设备状态。
- 手机应用：当前数据结构中的 `tasks` 和 `completed` 已经是可同步的 JSON，后续可复用到移动端接口。
