const express = require("express");
const multer = require("multer");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const router = express.Router();
const mongoose = require("mongoose");
const Ticket = require("../models/Ticket");
const User = require("../models/User");
const Asset = require("../models/Asset");
const AssetsFolders = require("../models/AssetsFolder");
const checkRole = require("../middleware/checkRole");
const { sendTicketConfirmation } = require("../middleware/mailer/mailer");
const addTimelineEvent = require("../middleware/AddTimelineEvents");
const json2csv = require("json2csv").parse; // Ensure this is installed (`npm install json2csv`)

// AWS S3 Configuration
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Multer setup with memory storage to upload to S3 manually
const upload = multer({
  storage: multer.memoryStorage(),
});

// @route   GET api/tickets
// @desc    Get all tickets with pagination and filtering by status
// @access  Public
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status || "";
    const skip = (page - 1) * limit;
    const escalationLevel = req.query.escalationLevel;

    let filter = {};

    if (escalationLevel === "administrator" || escalationLevel === "staff") {
      if (status) {
        filter.status = status;
      }
    } else {
      if (status) {
        filter.status = status;
      }
      if (escalationLevel) {
        filter.escalationLevel = escalationLevel;
      }
    }

    const tickets = await Ticket.find(filter)
      .populate("assignedTo")
      .skip(skip)
      .limit(limit);
    const totalTickets = await Ticket.countDocuments(filter);

    res.json({
      tickets,
      totalTickets,
      totalPages: Math.ceil(totalTickets / limit),
      currentPage: page,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   POST api/tickets/create
// @desc    Create a new ticket
// @access  Public
router.post("/create", upload.array("attachments", 10), async (req, res) => {
  const { ticketNumber, email, title, description, department, status, priority, type, assignedTo, dueDate } = req.body;

  // Process uploaded files to get the S3 URLs
  const attachments = req.files
    ? req.files.map(async (file) => {
        const uploadParams = {
          Bucket: process.env.AWS_S3_BUCKET,
          Key: `ticket-attachments/${Date.now()}_${file.originalname}`,
          Body: file.buffer,
          ContentType: file.mimetype,
        };

        try {
          const data = await s3.send(new PutObjectCommand(uploadParams));
          return {
            filename: file.originalname,
            url: `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${uploadParams.Key}`,
            uploadedAt: Date.now(),
          };
        } catch (err) {
          console.error("Error uploading file to S3:", err);
          throw new Error("File upload failed");
        }
      })
    : [];

  try {
    const resolvedAttachments = await Promise.all(attachments);

    let assignedToId = null;
    if (assignedTo) {
      const user = await User.findOne({ username: assignedTo });
      if (user) {
        assignedToId = user._id;
      } else {
        return res.status(400).json({ msg: "Assigned user not found" });
      }
    }

    const newTicket = new Ticket({
      ticketNumber,
      email,
      title,
      description,
      status,
      priority,
      department,
      type,
      severityLevel: "Minor",
      assignedTo: assignedToId,
      dueDate,
      attachments: resolvedAttachments,
    });

    await newTicket.save();

    // Create or find the assets folder for the 'Ticket' category
    let folder = await AssetsFolders.findOne({ category: "Ticket" });
    if (!folder) {
      folder = new AssetsFolders({ category: "Ticket" });
      await folder.save();
    }

    // Create assets based on ticket attachments
    const assets = await Promise.all(
      resolvedAttachments.map(async (attachment, index) => {
        const newAsset = new Asset({
          category: "Ticket",
          assetTag: `${ticketNumber}-${index + 1}`,
          assetName: attachment.filename,
          assetType: "Tickets",
          assetPath: attachment.url,
          folder: folder._id,
        });
        await newAsset.save();
        folder.assets.push(newAsset._id);
        return newAsset;
      })
    );

    await folder.save();

    const recipientEmail = email ? email : "mavericktena@gmail.com";
    await sendTicketConfirmation(newTicket, recipientEmail);

    await addTimelineEvent(
      newTicket._id,
      newTicket.assignedTo,
      newTicket.status,
      "The ticket was created successfully."
    );

    res.json(newTicket);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   GET api/tickets/count
// @desc    Get ticket count by status
// @access  Public
router.get("/count", async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const count = await Ticket.countDocuments(filter);
    res.json({ count });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

// @route   GET api/tickets/count/personal/:id
// @desc    Get ticket count by status for a specific user
// @access  Public
router.get("/count/personal/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.query;
    const filter = { assignedTo: id };
    if (status) {
      filter.status = status;
    }
    const count = await Ticket.countDocuments(filter);
    res.json({ count });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

// @route   GET api/tickets/by-status
// @desc    Get tickets by status
// @access  Public
router.get("/by-status", async (req, res) => {
  try {
    const { status, id } = req.query;
    const filter = {};
    if (status) {
      filter.status = status;
    }
    if (id) {
      filter.assignedTo = id;
    }
    const tickets = await Ticket.find(filter).populate("assignedTo");
    res.json(tickets);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   PUT api/tickets/edit/:id
// @desc    Edit a ticket by ID
// @access  Restricted to specific roles
router.put(
  "/edit/:id",
  upload.array("attachments", 10),
  checkRole(["administrator", "staff", "hardware-team", "software-team"]),
  async (req, res) => {
    const { id } = req.params;
    const currentUser = req.user;
    const { ticketNumber, title, description, status, priority, type, assignedTo, dueDate, comment, escalationLevel } =
      req.body;

    try {
      let assignedToId = null;
      if (assignedTo) {
        const user = await User.findOne({ username: assignedTo });
        if (user) {
          assignedToId = user._id;
        } else {
          return res.status(400).json({ msg: "Assigned user not found" });
        }
      }

      const updatedTicket = {
        ticketNumber,
        title,
        description,
        status,
        priority,
        type,
        severityLevel: "Minor",
        escalationLevel,
        dueDate,
        assignedTo: assignedToId,
      };

      const ticket = await Ticket.findByIdAndUpdate(id, { $set: updatedTicket }, { new: true });

      await addTimelineEvent(
        id,
        currentUser._id,
        status,
        comment || "The ticket was updated with new information."
      );

      res.json(ticket);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
    }
  }
);

// @route   GET api/tickets/export
// @desc    Export tickets as CSV
// @access  Restricted to administrator/staff
router.get("/export", checkRole(["administrator", "staff"]), async (req, res) => {
  try {
    const status = req.query.status || "";
    const filter = status ? { status } : {};
    const tickets = await Ticket.find(filter).populate("assignedTo");

    const csv = json2csv(
      tickets.map((ticket) => ({
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        type: ticket.type,
        assignedTo: ticket.assignedTo
          ? `${ticket.assignedTo.username} (${ticket.assignedTo.email})`
          : "Unassigned",
        dueDate: ticket.dueDate ? new Date(ticket.dueDate).toLocaleDateString() : "N/A",
        attachments: ticket.attachments.map((att) => att.filename).join("; "),
      }))
    );

    res.header("Content-Type", "text/csv");
    res.attachment("tickets.csv");
    res.send(csv);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   GET api/tickets/track/:ticketNumber
// @desc    Track a ticket by ticket number
// @access  Public
router.get("/track/:ticketNumber", async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ ticketNumber: req.params.ticketNumber });
    if (!ticket) {
      return res.status(404).json({ msg: "Ticket not found" });
    }
    res.json(ticket);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   PATCH api/tickets/:id/update/status
// @desc    Update ticket status
// @access  Public
router.patch("/:id/update/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const currentUser = req.user;

  try {
    const ticket = await Ticket.findByIdAndUpdate(id, { status }, { new: true }).populate("assignedTo");

    await addTimelineEvent(
      id,
      currentUser._id,
      status || "The ticket status was updated."
    );

    res.json(ticket);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route   GET api/tickets/analytics
// @desc    Get ticket analytics (status, priority, common problems, key metrics)
// @access  Public (or restrict with checkRole if needed)
router.get("/analytics", async (req, res) => {
  try {
    // Status Distribution
    const statusDistribution = await Ticket.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $project: { status: "$_id", count: 1, _id: 0 } },
    ]).then((results) =>
      results.reduce((acc, { status, count }) => ({ ...acc, [status]: count }), {})
    );

    // Priority Breakdown
    const priorityBreakdown = await Ticket.aggregate([
      { $group: { _id: "$priority", count: { $sum: 1 } } },
      { $project: { priority: "$_id", count: 1, _id: 0 } },
    ]).then((results) =>
      results.reduce((acc, { priority, count }) => ({ ...acc, [priority]: count }), {})
    );

    // Most Common Problems (based on title)
    const commonProblems = await Ticket.aggregate([
      { $group: { _id: "$title", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { title: "$_id", count: 1, _id: 0 } },
    ]);

    // Total Tickets
    const totalTickets = await Ticket.countDocuments();

    // Unassigned Tickets
    const unassignedTickets = await Ticket.countDocuments({ assignedTo: null });

    // Average Resolution Time (for Resolved/Closed tickets)
    const resolutionTime = await Ticket.aggregate([
      { $match: { status: { $in: ["Resolved", "Closed"] } } },
      {
        $project: {
          duration: { $subtract: ["$updatedAt", "$createdAt"] },
        },
      },
      {
        $group: {
          _id: null,
          avgDuration: { $avg: "$duration" },
        },
      },
    ]);

    const avgResolutionTime = resolutionTime[0]
      ? `${Math.round(resolutionTime[0].avgDuration / (1000 * 60 * 60))} hours`
      : "N/A";

    // Ensure all possible statuses and priorities are included, even if count is 0
    const allStatuses = ["Open", "In Progress", "Resolved", "Closed"];
    const allPriorities = ["Low", "Medium", "High", "Urgent"];
    const completeStatusDistribution = allStatuses.reduce(
      (acc, status) => ({ ...acc, [status]: statusDistribution[status] || 0 }),
      {}
    );
    const completePriorityBreakdown = allPriorities.reduce(
      (acc, priority) => ({ ...acc, [priority]: priorityBreakdown[priority] || 0 }),
      {}
    );

    res.json({
      statusDistribution: completeStatusDistribution,
      priorityBreakdown: completePriorityBreakdown,
      commonProblems,
      totalTickets,
      unassignedTickets,
      avgResolutionTime,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Error fetching analytics", error: err.message });
  }
});

module.exports = router;
