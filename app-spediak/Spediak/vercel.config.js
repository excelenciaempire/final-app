module.exports = {
  rewrites: [
    {
      source: '/(.*)',
      destination: '/'
    }
  ],
  trailingSlash: false,
  routes: [
    { handle: 'filesystem' },
    { src: '/(.*)', dest: '/' }
  ]
}; 