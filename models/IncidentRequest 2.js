const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const IncidentRequestSchema = new Schema({
  incidentNumber: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true
  },
  assignedTo: {
    type: String,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = IncidentRequest = mongoose.model('incidentRequests', IncidentRequestSchema);
