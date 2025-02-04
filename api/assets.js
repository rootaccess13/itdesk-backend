const express = require('express');
const router = express.Router();
const Asset = require('../models/Asset');
const AssetsFolders = require('../models/AssetsFolder');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid'); // Import uuid to generate unique IDs

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

// Multer setup with memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // Set file size limit (10 MB)
});

// Helper function to upload a file to S3
const uploadToS3 = async (file) => {
  const fileKey = `${Date.now()}_${uuidv4()}_${file.originalname}`;
  const params = {
    Bucket: process.env.AWS_S3_BUCKET, // Ensure this environment variable is set
    Key: fileKey,
    Body: file.buffer, // File data stored in memory
    ContentType: file.mimetype,
  };

  try {
    const data = await s3.send(new PutObjectCommand(params));
    return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
  } catch (error) {
    console.error('Error uploading file to S3:', error.message);
    throw new Error('Error uploading file to S3');
  }
};

router.post('/create', upload.array('attachments', 10), async (req, res) => {
  const {
    folderId, assetName, assetType, assetDescription,
    purchaseDate, cost, vendor, invoiceNumber,
    warranty, purchaseOrderNumber, location, hardwareSpecs, softwareVersion
  } = req.body;

  if (!folderId) {
    return res.status(400).json({ msg: 'Folder ID is required' });
  }

  try {
    // Fetch the folder to get the category
    const folder = await AssetsFolders.findById(folderId);
    if (!folder) {
      return res.status(404).json({ msg: 'Folder not found' });
    }

    const assets = await Promise.all(req.files.map(async (file) => {
      // Upload file to S3
      const fileUrl = await uploadToS3(file);

      // Generate a unique assetTag
      const assetTag = `TAG-${uuidv4()}`; // Use UUID for unique tag

      // Create a new asset object
      const newAsset = new Asset({
        assetTag: assetTag,
        assetName: assetName || file.originalname,
        assetType: assetType || file.mimetype,
        assetDescription: assetDescription || '',
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        cost: cost || null,
        vendor: vendor || '',
        invoiceNumber: invoiceNumber || '',
        warranty: warranty || '',
        purchaseOrderNumber: purchaseOrderNumber || '',
        location: location || '',
        hardwareSpecs: hardwareSpecs || '',
        softwareVersion: softwareVersion || '',
        assetPath: fileUrl, // Save S3 URL of the uploaded file
        category: folder.category,
        folder: folderId,
        dateCreated: Date.now(),
      });

      // Save asset to database
      return newAsset.save();
    }));

    // Add assets to the folder
    folder.assets.push(...assets.map(asset => asset._id));
    await folder.save();

    // Return saved assets
    res.json({ assets });
  } catch (err) {
    console.error('Error creating assets:', err.message);
    res.status(500).send('Server Error');
  }
});


// Get all assets
router.get('/', (req, res) => {
  Asset.find()
    .then(assets => res.json(assets))
    .catch(err => res.status(400).json(err));
});

// Get a single asset by ID
router.get('/:id', (req, res) => {
  Asset.findById(req.params.id)
    .then(asset => res.json(asset))
    .catch(err => res.status(400).json(err));
});

// Update an asset by ID
router.put('/:id', async (req, res) => {
  try {
    const asset = await Asset.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!asset) {
      return res.status(404).json({ msg: 'Asset not found' });
    }
    res.json(asset);
  } catch (err) {
    console.error('Error updating asset:', err.message);
    res.status(400).json(err);
  }
});

// Delete an asset by ID
router.delete('/:id', async (req, res) => {
  try {
    const asset = await Asset.findByIdAndRemove(req.params.id);
    if (!asset) {
      return res.status(404).json({ msg: 'Asset not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting asset:', err.message);
    res.status(400).json(err);
  }
});

router.get('/folder/list', async (req, res) => {
  try {
    const folders = await AssetsFolders.find().populate('category');
    // Log the fetched folders
    console.log('Fetched folders:', folders);
    res.json(folders);
  } catch (err) {
    console.error('Error fetching asset folders:', err.message);
    res.status(500).send('Server Error');
  }
});

router.post('/folder/create', async (req, res) => {
  try {
    const newFolder = new AssetsFolders({
      category: req.body.category,
    });
    await newFolder.save();
    res.json(newFolder);
  } catch (err) {
    console.error('Error creating asset folder:', err.message);
    res.status(500).send('Server Error');
  }
});

router.get('/folder/:id', async (req, res) => {
  try {
    const folder = await AssetsFolders.findById(req.params.id).populate('assets');
    if (!folder) {
      return res.status(404).json({ msg: 'Folder not found' });
    }
    res.json(folder);
  } catch (err) {
    console.error('Error fetching asset folder:', err.message);
    res.status(500).send('Server Error');
  }
});

router.post('/move', async (req, res) => {
  const { assetId, targetFolderId } = req.body;

  if (!assetId || !targetFolderId) {
    return res.status(400).json({ msg: 'Asset ID and target folder ID are required' });
  }

  try {
    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.status(404).json({ msg: 'Asset not found' });
    }

    const targetFolder = await AssetsFolders.findById(targetFolderId);
    if (!targetFolder) {
      return res.status(404).json({ msg: 'Target folder not found' });
    }

    // Remove asset from current folder
    const currentFolder = await AssetsFolders.findById(asset.folder);
    if (currentFolder) {
      currentFolder.assets.pull(asset._id);
      await currentFolder.save();
    }

    // Add asset to target folder
    targetFolder.assets.push(asset._id);
    await targetFolder.save();

    // Update asset's folder reference
    asset.folder = targetFolderId;
    await asset.save();

    res.json({ msg: 'Asset moved successfully', asset });
  } catch (err) {
    console.error('Error moving asset:', err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
