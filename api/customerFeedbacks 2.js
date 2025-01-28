const express = require('express');
const router = express.Router();
const CustomerFeedback = require('../../models/CustomerFeedback');
const Ticket = require('../../models/Ticket'); // Ensure you have a Ticket model
const addTimelineEvent = require('../../middleware/AddTimelineEvents');

// Create a new customer feedback for a specific ticket
router.post('/create/:ticketId', async (req, res) => {
  const { ticketId } = req.params;
  const { feedback, rating, assignedTo } = req.body;

  try {
    // Create a new feedback entry
    const newCustomerFeedback = new CustomerFeedback({
      ticketId: ticketId, // Use the ticketId from URL
      feedback: feedback,
      rating: rating,
    });

    // Save the feedback entry to the database
    const savedFeedback = await newCustomerFeedback.save();

    // Update the ticket to set has_feedback to true
    await Ticket.findByIdAndUpdate(ticketId, { has_feedback: true, status: 'Closed' });

    // Add a timeline event for the feedback
    await addTimelineEvent(ticketId, assignedTo,'CLosed', 'Feedback received from customer and ticket closed.');

    res.json(savedFeedback);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// Get all customer feedbacks
router.get('/', (req, res) => {
  CustomerFeedback.find()
    .then(customerFeedbacks => res.json(customerFeedbacks))
    .catch(err => res.status(400).json(err));
});

// Get a single customer feedback by ID
router.get('/:ticketId', (req, res) => {
  // Extract ticketId from the URL parameters
  const { ticketId } = req.params;

  // Find feedback based on ticketId
  CustomerFeedback.findOne({ ticketId: ticketId })
    .then(customerFeedback => {
      if (!customerFeedback) {
        return res.status(404).json({ message: "Feedback not found for this ticket." });
      }
      res.json(customerFeedback);
    })
    .catch(err => res.status(400).json(err));
});

// Update a customer feedback by ID
router.put('/:id', (req, res) => {
  CustomerFeedback.findByIdAndUpdate(req.params.id, req.body, { new: true })
    .then(customerFeedback => res.json(customerFeedback))
    .catch(err => res.status(400).json(err));
});

// Delete a customer feedback by ID
router.delete('/:id', (req, res) => {
  CustomerFeedback.findByIdAndRemove(req.params.id)
    .then(customerFeedback => res.json({ success: true }))
    .catch(err => res.status(400).json(err));
});

module.exports = router;
