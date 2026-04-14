const mongoose = require('mongoose');

const versionSchema = new mongoose.Schema({
  datasetId:         { type: String, required: true, index: true },
  versionNumber:     { type: Number, required: true },
  previousHash:      { type: String, default: '' },
  fileHash:          { type: String, required: true },
  changeDescription: { type: String, default: '' },
  updatedBy:         { type: String, required: true },
  timestamp:         { type: Number, required: true },  // Unix timestamp (seconds)
  ipfsCid:           { type: String, default: '' },
}, { versionKey: false });

// Compound index for fast ordered version lookups
versionSchema.index({ datasetId: 1, versionNumber: 1 });

module.exports = mongoose.model('Version', versionSchema);
