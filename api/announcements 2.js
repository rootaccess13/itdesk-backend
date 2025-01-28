const express = require('express');
const router = express.Router();
const Announcement = require('../../models/Announcement');
const Notification = require('../../models/Notification');
const multer = require('multer');
const { sendBulkEmail } = require('../../middleware/mailer/mailer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');  // Import AWS S3 client
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
const storage = multer.memoryStorage(); // Use memoryStorage instead of diskStorage
const upload = multer({ storage });

// Create a new announcement
router.post('/create', upload.single('banner'), async (req, res) => {
  let bannerUrl = null;

  // If there is a banner (image), upload it to S3
  if (req.file) {
    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET, // S3 bucket name
      Key: `announcements/${Date.now()}_${req.file.originalname}`,  // Path within S3
      Body: req.file.buffer,  // The file content as buffer
      ContentType: req.file.mimetype, // Content type (e.g., image/png)
    };

    try {
      // Upload to S3
      const data = await s3.send(new PutObjectCommand(uploadParams));
      bannerUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${uploadParams.Key}`;  // Construct the URL of the uploaded file
    } catch (err) {
      return res.status(500).json({ message: "Error uploading to S3", error: err.message });
    }
  }

  // Create a new Announcement document
  const newAnnouncement = new Announcement({
    title: req.body.title,
    content: req.body.content,
    banner: bannerUrl,  // S3 URL of the banner
    is_public: req.body.is_public || true,
    is_active: req.body.is_active || true,
  });

  // Create a new Notification document
  const newNotification = new Notification({
    title: req.body.title,
    message: req.body.content,
    banner: bannerUrl,  // S3 URL of the banner
  });

  try {
    // Save the announcement and notification to the database
    const savedAnnouncement = await newAnnouncement.save();
    const savedNotification = await newNotification.save();

    // If the announcement is public, send a bulk email
    if (savedAnnouncement.is_public) {
      const subject = `New Announcement: ${savedAnnouncement.title}`;
      const htmlContent = `
        ${savedAnnouncement.banner ? `<img src="${savedAnnouncement.banner}" alt="${savedAnnouncement.title}" style="width:100%; height:auto;" />` : ''}
        <h1>${savedAnnouncement.title}</h1>
        <p>${savedAnnouncement.content}</p>
      `;
      await sendBulkEmail(subject, htmlContent);
    }

    // Respond with the saved announcement
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
  Announcement.findByIdAndRemove(req.params.id)
    .then(announcement => res.json({ success: true }))
    .catch(err => res.status(400).json(err));
});

module.exports = router;
