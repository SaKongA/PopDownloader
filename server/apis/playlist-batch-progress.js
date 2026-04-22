const { getBatchProgress } = require('../utils/batch-progress-store')

module.exports = {
  name: 'playlist-batch-progress',
  method: 'get',
  path: '/api/playlist/batch-progress',
  handler: async (req, res) => {
    const batchId = req.query?.batch_id || ''

    if (!batchId) {
      res.status(400).json({
        message: 'batch_id is required',
      })
      return
    }

    const progress = getBatchProgress(batchId)

    if (!progress) {
      res.status(404).json({
        message: 'batch progress not found',
      })
      return
    }

    res.json(progress)
  },
}
