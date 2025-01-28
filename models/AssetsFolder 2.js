const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AssetsFolderSchema = new Schema({
  category: {
    type: String,
    required: true,
    unique: true
  },
  assets: [{
    type: Schema.Types.ObjectId,
    ref: 'Assets' // Ensure this matches your Asset model name
  }],
  dateCreated: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AssetsFolders', AssetsFolderSchema);
