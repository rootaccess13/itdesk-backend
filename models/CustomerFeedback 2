const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CustomerFeedbackSchema = new Schema({
  ticketId: {
    type: String,
    required: true
  },
  feedback: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = CustomerFeedback = mongoose.model('customerFeedbacks', CustomerFeedbackSchema);
