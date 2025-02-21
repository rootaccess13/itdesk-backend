const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const Notification = require('../models/Notification');
const multer = require('multer');
const { sendBulkEmail } = require('../middleware/mailer/mailer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// Initialize AWS S3 client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

// Configure multer to store files in memory (required for S3 upload)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Create a new announcement
router.post('/create', upload.single('banner'), async (req, res) => {
  let bannerUrl = null;

  if (req.file) {
    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: `announcements/${Date.now()}_${req.file.originalname}`,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    try {
      const data = await s3.send(new PutObjectCommand(uploadParams));
      bannerUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${uploadParams.Key}`;
    } catch (err) {
      return res.status(500).json({ message: "Error uploading to S3", error: err.message });
    }
  }

  const newAnnouncement = new Announcement({
    title: req.body.title,
    content: req.body.content,
    banner: bannerUrl,
    is_public: req.body.is_public || true,
    is_active: req.body.is_active || true,
  });

  const newNotification = new Notification({
    title: req.body.title,
    message: req.body.content,
    banner: bannerUrl,
  });

  try {
    const savedAnnouncement = await newAnnouncement.save();
    const savedNotification = await newNotification.save();

    if (savedAnnouncement.is_public) {
      const subject = `New Announcement: ${savedAnnouncement.title}`;
      const htmlContent = `
        ${savedAnnouncement.banner ? `<img src="${savedAnnouncement.banner}" alt="${savedAnnouncement.title}" style="width:100%; height:auto;" />` : ''}
        <h1>${savedAnnouncement.title}</h1>
        <p>${savedAnnouncement.content}</p>
      `;
      await sendBulkEmail(subject, htmlContent);
    }

    res.json(savedAnnouncement);
  } catch (err) {
    res.status(400).json(err);
  }
});

// Get all announcements
router.get('/', (req, res) => {
  Announcement.find()
    .then(announcements => res.json(announcements))
    .catch(err => res.status(400).json(err));
});

// Get a single announcement by ID
router.get('/:id', (req, res) => {
  Announcement.findById(req.params.id)
    .then(announcement => res.json(announcement))
    .catch(err => res.status(400).json(err));
});

// Update an announcement by ID
router.put('/:id', (req, res) => {
  Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true })
    .then(announcement => res.json(announcement))
    .catch(err => res.status(400).json(err));
});

// Delete an announcement by ID
router.delete('/:id', (req, res) => {
  Announcement.findByIdAndDelete(req.params.id)
    .then(announcement => {
      if (!announcement) {
        return res.status(404).json({ message: 'Announcement not found' });
      }
      res.json({ success: true, message: 'Announcement deleted successfully' });
    })
    .catch(err => res.status(400).json({ message: 'Error deleting announcement', error: err }));
});

module.exports = router;
