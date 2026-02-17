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
        { property: 'og:title', content: 'LAUNCH — SpaceX Launch Simulator' },
        { property: 'og:description', content: 'Launch a rocket to orbit. Time your staging perfectly.' },
        { property: 'og:image', content: 'https://space.indiega.me/space.jpg' },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: 'https://space.indiega.me' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:image', content: 'https://space.indiega.me/space.jpg' },
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