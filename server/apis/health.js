const request = {
  method: 'get',
  path: '/api/health',
  query: {},
  headers: {},
  body: null,
}

const response = {
  message: 'PopDownloader local API is running',
  author: 'jason',
  port: 3001,
}

module.exports = {
  name: 'health',
  method: request.method,
  path: request.path,
  request,
  response,
  handler: (_req, res) => {
    res.json({
      message: response.message,
      author: response.author,
      port: process.env.PORT || response.port,
    })
  },
}
