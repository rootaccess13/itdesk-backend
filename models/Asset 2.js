const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AssetSchema = new Schema({
  assetTag: {
    type: String,
    required: true,
    unique: true,
  },
  assetName: {
    type: String,
    required: true,
  },
  assetType: {
    type: String,
    required: true,
    enum: ['Purchase', 'Software', 'Hardware','Tickets', 'Other'], // Enum to restrict types
  },
  assetPath: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  folder: {
    type: Schema.Types.ObjectId,
    ref: 'AssetsFolders',
  },
  dateCreated: {
    type: Date,
    default: Date.now,
  },
  // Fields specific to "Purchase"
  purchaseDate: {
    type: Date,
  },
  cost: {
    type: Number,
  },
  vendor: {
    type: String,
  },
  invoiceNumber: {
    type: String,
  },
  warranty: {
    type: String,
  },
  purchaseOrderNumber: {
    type: String,
  },
  location: {
    type: String,
  },
  // Fields specific to "Hardware"
  hardwareSpecs: {
    type: String,
  },
  // Fields specific to "Software"
  softwareVersion: {
    type: String,
  },
});

module.exports = Asset = mongoose.model('Assets', AssetSchema);
