const express = require('express');
const router = express.Router();
const IncidentRequest = require('../models/IncidentRequest');

// Create a new incident request
router.post('/create', (req, res) => {
  const newIncidentRequest = new IncidentRequest({
    incidentNumber: req.body.incidentNumber,
    title: req.body.title,
    description: req.body.description,
    status: req.body.status,
    assignedTo: req.body.assignedTo,
  });

  newIncidentRequest.save()
    .then(incidentRequest => res.json(incidentRequest))
    .catch(err => res.status(400).json(err));
});

// Get all incident requests
router.get('/', (req, res) => {
  IncidentRequest.find()
    .then(incidentRequests => res.json(incidentRequests))
    .catch(err => res.status(400).json(err));
});

// Get a single incident request by ID
router.get('/:id', (req, res) => {
  IncidentRequest.findById(req.params.id)
    .then(incidentRequest => res.json(incidentRequest))
    .catch(err => res.status(400).json(err));
});

// Update an incident request by ID
router.put('/:id', (req, res) => {
  IncidentRequest.findByIdAndUpdate(req.params.id, req.body, { new: true })
    .then(incidentRequest => res.json(incidentRequest))
    .catch(err => res.status(400).json(err));
});

// Delete an incident request by ID
router.delete('/:id', (req, res) => {
  IncidentRequest.findByIdAndRemove(req.params.id)
    .then(incidentRequest => res.json({ success: true }))
    .catch(err => res.status(400).json(err));
});

module.exports = router;
