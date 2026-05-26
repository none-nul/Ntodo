# Ntodo Android

原生 Android 版 Ntodo，保留基础待办和 AI 添加，去掉桌面版的快捷键、透明、托盘和悬浮穿透逻辑。

## 功能

- 手动添加、完成、恢复、删除 todo
- AI 解析自然语言生成 todo
- 本机保存 OpenAI API Key、Base URL、Model
- 请求手机日历权限
- 将 todo 添加到系统日历
- 修改已关联 todo 的日程日期
- 删除 todo 时同步删除关联日程
- Android 桌面小组件显示剩余待办

## 构建

1. 打开 Android Studio
2. 选择 `Open`
3. 打开仓库里的 `mobile/android` 文件夹，不要打开仓库根目录
4. 等待 Gradle Sync 完成
5. 选择顶部运行配置 `app`
6. 连接 Android 手机并开启 USB 调试，或创建模拟器
7. 点击 Run

命令行环境可用时：

```powershell
cd mobile/android
gradle :app:assembleDebug
```

## 说明

- 当前项目没有提交 Gradle Wrapper，需要 Android Studio 或本机 Gradle。
- 本机已生成 `local.properties`，指向 `C:\Users\liao\AppData\Local\Android\Sdk`。
- 日历访问依赖系统日历 Provider，不同手机厂商可能会要求用户额外允许日历权限。
- 小组件会显示最多 6 条未完成 todo，点击小组件进入 App。
