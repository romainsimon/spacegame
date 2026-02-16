export default defineNuxtConfig({
  compatibilityDate: '2025-01-16',
  devtools: { enabled: false },
  ssr: false,

  modules: ['@pinia/nuxt'],

  typescript: {
    strict: true,
    typeCheck: false,
  },

  app: {
    head: {
      title: 'LAUNCH — SpaceX Launch Simulator',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'Launch a rocket to orbit. Time your staging perfectly.' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&family=JetBrains+Mono:wght@400;600&display=swap' },
      ],
      script: [
        { defer: true, 'data-domain': 'space.indiega.me', src: 'https://stats.yukicapital.com/js/script.js' },
      ],
    },
  },

  css: ['~/assets/css/main.css'],
})