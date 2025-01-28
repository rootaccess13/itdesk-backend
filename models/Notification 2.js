const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const NotificationSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    banner: {
        type: String,
        default: 'http://localhost:5001/uploads/banners/1722262677123_Screen Shot 2024-07-26 at 15.01.52 PM.png'
    },
    is_read: {
        type: Boolean,
        default: false
    },
    viewedBy: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});


module.exports = Notification = mongoose.model('notifications', NotificationSchema);
