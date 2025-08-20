const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Notification = require('../models/Notification');
const CommunicationLog = require('../models/CommunicationLog');

// Core ticket operations
exports.createTicket = async (req, res) => {
  try {
    const ticket = new Ticket({
      ...req.body,
      createdBy: req.user.id,
      messages: [{
        user: req.user.id,
        content: req.body.description,
        attachments: req.body.attachments || []
      }]
    });
    await ticket.save();
    await logTicketActivity(ticket, 'created', req.user.id);
    await notifySupportTeam(ticket);
    res.status(201).json(ticket);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create ticket', error: error.message });
  }
};

exports.getTickets = async (req, res) => {
  try {
    const query = buildTicketQuery(req);
    const tickets = await Ticket.find(query)
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .sort({ [req.query.sortBy || 'createdAt']: req.query.sortOrder === 'asc' ? 1 : -1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch tickets', error: error.message });
  }
};

// Helper functions
async function logTicketActivity(ticket, action, userId) {
  await CommunicationLog.log({
    user: userId,
    type: 'ticket',
    direction: 'inbound',
    subject: `Ticket ${ticket._id} ${action}`,
    content: `Ticket was ${action}`,
    relatedTo: ticket.category,
    referenceId: ticket._id,
    referenceModel: 'Ticket',
    initiatedBy: userId
  });
}

async function notifySupportTeam(ticket) {
  const agents = await User.find({
    role: { $in: ['support', 'admin'] },
    isAvailable: true
  }).limit(5);

  const notifications = agents.map(agent => ({
    user: agent._id,
    type: 'new_ticket',
    title: 'New Support Ticket',
    message: `New ticket: ${ticket.title}`,
    data: { ticketId: ticket._id },
    priority: ['high', 'urgent'].includes(ticket.priority) ? 'high' : 'medium'
  }));

  if (notifications.length) {
    await Notification.insertMany(notifications);
    const io = require('../app').io;
    agents.forEach(agent => {
      io.to(`user_${agent._id}`).emit('notification', {
        type: 'new_ticket',
        data: { ticketId: ticket._id }
      });
    });
  }
}

function buildTicketQuery(req) {
  const { status, category, priority, assignedTo } = req.query;
  const query = {};
  const isSupport = ['support', 'admin'].includes(req.user.role);

  if (status) query.status = status;
  if (category) query.category = category;
  if (priority) query.priority = priority;

  if (isSupport) {
    if (assignedTo === 'me') query.assignedTo = req.user.id;
    else if (assignedTo === 'unassigned') query.assignedTo = { $exists: false };
    else if (assignedTo) query.assignedTo = assignedTo;
  } else {
    query.createdBy = req.user.id;
  }

  return query;
}
