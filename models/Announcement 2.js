const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AnnouncementSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  banner: {
    type: String,
    default: 'http://localhost:5001/uploads/banners/1722262677123_Screen Shot 2024-07-26 at 15.01.52 PM.png'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  is_public: {
    type: Boolean,
    default: true
  }, is_active: {
    type: Boolean,
    default: true
  }
});

module.exports = Announcement = mongoose.model('announcements', AnnouncementSchema);
