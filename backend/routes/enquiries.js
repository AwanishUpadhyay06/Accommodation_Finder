const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Enquiry = require('../models/Enquiry');
const Property = require('../models/Property');
const Notification = require('../models/Notification');
const { auth, authorize } = require('../middleware/auth');

// @route   POST /api/enquiries
// @desc    Send enquiry to property owner
// @access  Private (tenant only)
router.post('/', [
  auth,
  body('property').isMongoId().withMessage('Valid property ID is required'),
  body('subject').trim().isLength({ min: 5 }).withMessage('Subject must be at least 5 characters'),
  body('message').trim().isLength({ min: 20 }).withMessage('Message must be at least 20 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { property: propertyId, subject, message } = req.body;

    // Check if property exists
    const property = await Property.findById(propertyId).populate('owner');
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // Create enquiry
    const enquiry = new Enquiry({
      user: req.user.id,
      property: propertyId,
      owner: property.owner._id,
      subject,
      message
    });

    await enquiry.save();
    await enquiry.populate(['user', 'property', 'owner']);

    // Create notification for owner
    const notification = await Notification.create({
      user: property.owner._id,
      actor: req.user.id,
      type: 'enquiry_created',
      title: 'New enquiry received',
      message: `${enquiry.user.name || 'A user'} sent an enquiry: ${subject}`,
      entity: { id: enquiry._id, model: 'Enquiry' },
      priority: 'normal'
    });

    // Emit to owner's room
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${property.owner._id.toString()}`).emit('notification:new', notification);
      io.to(`user:${property.owner._id.toString()}`).emit('enquiry:created', enquiry);
    }

    res.status(201).json({
      message: 'Enquiry sent successfully',
      enquiry
    });
  } catch (error) {
    console.error('Error sending enquiry:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/enquiries/user
// @desc    Get user's enquiries
// @access  Private
router.get('/user', auth, async (req, res) => {
  try {
    const enquiries = await Enquiry.find({ user: req.user.id })
      .populate('property', 'title images')
      .populate('owner', 'name email')
      .sort({ createdAt: -1 });

    res.json(enquiries);
  } catch (error) {
    console.error('Error fetching user enquiries:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/enquiries/owner
// @desc    Get owner's enquiries
// @access  Private (owner only)
router.get('/owner', auth, async (req, res) => {
  try {
    const enquiries = await Enquiry.find({ owner: req.user.id })
      .populate('user', 'name email phone')
      .populate('property', 'title images')
      .sort({ createdAt: -1 });

    res.json(enquiries);
  } catch (error) {
    console.error('Error fetching owner enquiries:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/enquiries/:id/replies
// @desc    Add a reply to an enquiry (owner or tenant)
// @access  Private
router.post('/:id/replies', [
  auth,
  body('message').trim().isLength({ min: 1 }).withMessage('Message is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { message } = req.body;
    console.log('[Enquiries] Reply attempt', { id, requester: req.user && (req.user._id || req.user.id) });
    const enquiry = await Enquiry.findById(id).populate(['user', 'owner', 'property']);
    if (!enquiry) {
      console.warn('[Enquiries] Enquiry not found for reply', { id });
      return res.status(404).json({ message: `Enquiry not found`, id });
    }

    // Authorization: only owner or original user can reply
    const requesterId = (req.user && (req.user._id || req.user.id)) ? (req.user._id || req.user.id).toString() : null;
    const isOwner = enquiry.owner && enquiry.owner._id.toString() === requesterId;
    const isUser = enquiry.user && enquiry.user._id.toString() === requesterId;
    if (!isOwner && !isUser) {
      return res.status(403).json({ message: 'Not authorized to reply to this enquiry' });
    }

    enquiry.replies.push({ sender: requesterId, message, timestamp: new Date() });
    if (isOwner) {
      enquiry.status = 'replied';
    }
    await enquiry.save();

    // Notify the other party
    const recipientId = isOwner ? enquiry.user._id : enquiry.owner._id;
    const notification = await Notification.create({
      user: recipientId,
      actor: requesterId,
      type: 'enquiry_replied',
      title: 'New reply to enquiry',
      message: `${(req.user && req.user.name) || 'User'} replied: ${message.substring(0, 120)}${message.length > 120 ? '…' : ''}`,
      entity: { id: enquiry._id, model: 'Enquiry' },
      priority: 'normal'
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${recipientId.toString()}`).emit('notification:new', notification);
      io.to(`user:${recipientId.toString()}`).emit('enquiry:replied', {
        enquiryId: enquiry._id,
        reply: enquiry.replies[enquiry.replies.length - 1]
      });
    }

    res.json({ message: 'Reply added', enquiry });
  } catch (error) {
    console.error('Error adding enquiry reply:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
