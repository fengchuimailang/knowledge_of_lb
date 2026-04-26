---
date: 2026-04-26
---

# Cocos 小游戏包体优化：从 10MB 到 2MB 的实战经验

> 基于抖音/微信小游戏包体限制（主包 4MB 上限），结合参考项目村庄保卫战的分包策略，总结三合一游戏的核心优化方案。

## 背景

抖音和微信小游戏对包体有严格限制：

| 平台 | 主包限制 | 备注 |
|------|---------|------|
| 微信小程序 | 4MB | 超出必须走分包 |
| 抖音小游戏 | 4MB | 同上 |
| 支付宝小游戏 | 10MB | 相对宽松 |

> 据 Cocos 官方统计，每多加载 1 秒就有 **7% 的首日用户流失**，包体大小直接影响 ROI。

---

## 一、功能裁剪（引擎模块 Tree Shaking）

Cocos Creator 3.x 的引擎是模块化的，只打包你用到的功能。

### 裁剪方法

在 Cocos Creator 编辑器中：**Project → Module Config**

取消勾选不需要的模块：

```
✅ 保留
├── 2D Renderer      ← 必选
├── Animation         ← 必选（Spine 动画依赖）
├── Spine             ← 必选
├── UI                ← 必选
└── Tween             ← 常用

❌ 可裁剪
├── 3D Camera/Scene/Renderer  ← 2D 游戏不需要
├── Physics 2D/3D            ← 棋牌/三合一般不需要
├── Particle System            ← 除非有粒子特效
├── XR (AR/VR)                ← 几乎不用
├── Vehicle                    ← 车载相关，极少用到
└── Network (WebSocket)       ← 按需保留
```

### 预期效果

以 Toast N Roll 为例（2D + Spine + 基础动画）：

| 模块 | 裁剪前估计 | 裁剪后 |
|------|-----------|--------|
| 引擎基础 | ~800KB | ~400KB |
| 3D 模块 | ~300KB | 0 |
| 物理引擎 | ~200KB | 0 |
| 其他未用 | ~200KB | 0 |
| **合计** | **~1.5MB** | **~400KB** |

---

## 二、引擎 WASM 分包

开启引擎核心代码的 WebAssembly 分包，让引擎本身不占用主包空间。

### 配置位置

**Build 面板 → Main Bundle Compression Type**

```
压缩类型选项：
├── None              ← 不压缩，不推荐
├── Merge Depend      ← 合并依赖 ✅ 推荐
├── Merge All JSON    ← 合并所有 JSON
└── Zip               ← ZIP 压缩
```

### 核心作用

将引擎的 C++ 核心编译为 WASM，按需加载，主包只保留 JS 胶水代码。

---

## 三、主包只放 LoadScene

这是最关键的分包策略：**主包最小化，只放首屏必须内容**。

### 原则

```
主包（必须最小化）
└── Load.scene              ← 首屏场景，必须在主包
└── 基础框架脚本              ← 启动逻辑
└── 必要的预加载资源          ← 加载界面所需的资源

分包（按需加载）
├── 战斗场景                 ← 真正游戏内容
├── 商城/图鉴/设置            ← 附属功能
├── Spine 动画资源            ← 按需下载
└── 音效/音乐资源             ← 懒加载
```

### 配置方法

**1. 在编辑器中设置 Asset Bundle**

在 Assets 面板中，选中要分包的文件夹 → Properties 面板 → 勾选 `Is Bundle`

```
assets/
├── scenes/           ← Load.scene 保持默认
│   └── Load.scene   ← 主包
├── battle/          ← 右键 → Is Bundle = true → 分包
├── shop/            ← 同上
└── spine/           ← 同上
```

**2. 配置分包压缩类型**

参考项目（村庄保卫战）的 `settings/v2/packages/builder.json`：

```json
{
  "bundleConfig": {
    "custom": {
      "default": {
        "miniGame": {
          "fallbackOptions": {
            "compressionType": "merge_dep"
          },
          "overwriteSettings": {
            "wechatgame": { "compressionType": "subpackage" },
            "bytedance-mini-game": { "compressionType": "subpackage" },
            "alipay-mini-game": { "compressionType": "subpackage" }
          }
        }
      }
    }
  }
}
```

### 代码中加载分包

```typescript
import { director, resources } from 'cc';

// 加载游戏主场景（首次）
resources.load('battle/scene', (err, bundle) => {
  bundle.loadScene('Game', (err, scene) => {
    director.runScene(scene);
  });
});

// 加载商城等附属功能
resources.load('shop/bundle', (err, bundle) => {
  // 商城加载完成
});
```

---

## 四、效果预估

经过以上三步优化：

| 层级 | 内容 | 预计大小 |
|------|------|---------|
| 主包 | LoadScene + 引擎框架 | **2-3 MB** |
| 分包 1 | 战斗场景 + Spine | 按需 |
| 分包 2 | 商城/图鉴 | 按需 |
| 分包 3 | 音效资源 | 按需 |
| **总计** | | **< 4 MB** ✅ |

---

## 五、关键参考

- 📺 [Cocos Creator 优化发布到小游戏的包体大小](https://www.bilibili.com/video/av405901128) — 做游戏的大胖海，5809 播放
- 📺 [五步减小包体 提升加载速度](https://www.bilibili.com/video/av113128129956570) — Cocos 官方，3743 播放
- 📦 参考项目：村庄保卫战（3.8.3ts）— `settings/v2/packages/builder.json` 提供了实际配置

---

## 总结

三合一游戏包体优化的核心三点：

1. **功能裁剪** — 只打包用到的引擎模块
2. **WASM 分包** — 引擎核心代码单独加载
3. **主包最小化** — LoadScene 放主包，其他全部分包

> 目标：主包 **< 4MB**，符合抖音/微信小游戏限制，首屏加载时间 **< 3 秒**。

---

*本文持续更新中，欢迎补充更多实战经验。*
