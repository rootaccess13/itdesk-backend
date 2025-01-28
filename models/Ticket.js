const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TimelineEventSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
});

const AttachmentSchema = new Schema({
  filename: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

const TicketSchema = new Schema({
  ticketNumber: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: false,
    default: null
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true,
    enum: ['IT', 'HR', 'Finance', 'Operations', 'Other'],
    default: 'Other'
  },
  status: {
    type: String,
    required: false,
    enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
    default: 'Open'
  },
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    default: null
  },
  priority: {
    type: String,
    required: true,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Low'
  },
  type: {
    type: String,
    required: true,
    enum: ['Incident', 'Request', 'Other'],
    default: 'Other'
  },
  escalationLevel: {
    type: String,
    required: false,
    enum: ['None', 'Software Team', 'Network Team', 'Hardware Team'],
    default: 'None'
  },
  dueDate: {
    type: Date,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  has_feedback: {
    type: Boolean,
    default: false
  },
  attachments: [AttachmentSchema],
  timeline: [TimelineEventSchema],
});

// Middleware to set updatedAt before each save
TicketSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = Ticket = mongoose.model('tickets', TicketSchema);
