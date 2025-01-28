const mongoose = require('mongoose');
const Ticket = require('../models/Ticket'); // Adjust the path according to your project structure

const addTimelineEvent = async (ticketId, userId, title, description) => {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new Error('Ticket not found');

  const event = {
    title,
    description,
    user: new mongoose.Types.ObjectId(userId) // Use 'new' keyword here
  };

  ticket.timeline.push(event);
  await ticket.save();
};

module.exports = addTimelineEvent;
