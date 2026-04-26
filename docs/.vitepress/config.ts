import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Knowledge of LB',
  description: 'Personal knowledge blog by Liu Bo - Coding, Gaming, Startup',
  srcDir: '.',
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }]
  ],
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '游戏开发', link: '/gaming/' },
      { text: '工程实践', link: '/engineering/' },
      { text: 'AI 与效率', link: '/ai/' },
      { text: '创业记录', link: '/startup/' }
    ],
    sidebar: {
      '/gaming/': [
        {
          text: '游戏开发',
          items: [
            { text: 'Cocos Creator', link: '/gaming/cocos/' },
            { text: '游戏设计', link: '/gaming/design/' }
          ]
        }
      ],
      '/engineering/': [
        {
          text: '工程实践',
          items: [
            { text: '架构设计', link: '/engineering/architecture/' },
            { text: '工具链', link: '/engineering/tools/' }
          ]
        }
      ],
      '/ai/': [
        {
          text: 'AI 与效率',
          items: [
            { text: 'LLM 使用', link: '/ai/llm/' },
            { text: '自动化', link: '/ai/automation/' }
          ]
        }
      ],
      '/startup/': [
        {
          text: '创业记录',
          items: [
            { text: '产品思考', link: '/startup/product/' },
            { text: '小游戏复盘', link: '/startup/games/' }
          ]
        }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/fengchuimailang' }
    ]
  }
})
