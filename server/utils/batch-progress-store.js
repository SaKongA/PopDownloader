const store = new Map()

function createBatchProgress(batchId, total) {
  const snapshot = {
    batchId,
    total: Number(total) || 0,
    completed: 0,
    status: 'running',
    error: '',
    updatedAt: Date.now(),
  }

  store.set(batchId, snapshot)
  return snapshot
}

function updateBatchProgress(batchId, patch) {
  const current = store.get(batchId)

  if (!current) {
    return null
  }

  const next = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  }

  store.set(batchId, next)
  return next
}

function getBatchProgress(batchId) {
  return store.get(batchId) || null
}

function deleteBatchProgress(batchId) {
  store.delete(batchId)
}

module.exports = {
  createBatchProgress,
  updateBatchProgress,
  getBatchProgress,
  deleteBatchProgress,
}
