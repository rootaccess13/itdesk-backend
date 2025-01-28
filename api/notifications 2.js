const express = require('express');
const router = express.Router();
const Notification = require('../../models/Notification');
const mongoose = require('mongoose');

// Get all notifications
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId; // Assume user ID is passed as a query parameter

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Fetch notifications for the current user
    const notifications = await Notification.find({
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }, // Notifications for today
      viewedBy: { $ne: userId } // Exclude notifications already viewed by this user
    });

    res.status(200).json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/view', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body; // Extract userId from request body

    // Validate that userId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    console.log('Notification ID:', id);
    // Find notification by ID
    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Check if user has already viewed this notification
    if (!notification.viewedBy.includes(userId)) {
      notification.viewedBy.push(userId);
      await notification.save();
    }

    res.status(200).json(notification);
  } catch (error) {
    console.error('Error updating notification status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



module.exports = router;
