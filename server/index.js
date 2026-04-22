const express = require('express')
const path = require('path')
const fs = require('fs')
const apiDefinitions = require('./apis')

const app = express()
const port = process.env.PORT || 3001
const distPath = path.join(__dirname, '..', 'dist')

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

for (const definition of apiDefinitions) {
  app[definition.method](definition.path, definition.handler)
}

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))

  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(port, () => {
  console.log(`PopDownloader server listening on http://localhost:${port}`)
})
