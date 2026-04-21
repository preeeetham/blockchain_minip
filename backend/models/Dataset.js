const mongoose = require('mongoose');

const datasetSchema = new mongoose.Schema({
  datasetId: { type: String, required: true, unique: true, index: true },
  name:       { type: String, required: true },
  description:{ type: String, default: '' },
  currentHash:{ type: String, required: true },
  versionCount:{ type: Number, default: 1 },
  createdAt:  { type: Number, required: true },   // Unix timestamp (seconds)
  updatedAt:  { type: Number, required: true },
  ipfsCid:    { type: String, default: '' },
  metadataUri:{ type: String, default: '' },
  authority:  { type: String, required: true },   // wallet public key
  txSignature:{ type: String, default: '' },
  isActive:   { type: Boolean, default: true },
}, { versionKey: false });

module.exports = mongoose.model('Dataset', datasetSchema);
