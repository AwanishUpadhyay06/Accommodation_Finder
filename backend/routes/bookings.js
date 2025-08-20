const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const Property = require('../models/Property');
const User = require('../models/User');
// const Notification = require('../models/Notification'); // notifications removed
const { auth, authorize } = require('../middleware/auth');

// @route   POST /api/bookings/visit
// @desc    Schedule a property visit
// @access  Private (tenant only)
router.post('/visit', [
  auth,
  authorize('tenant'),
  body('property').isMongoId().withMessage('Valid property ID is required'),
  body('visitDate').isISO8601().withMessage('Valid visit date is required'),
  body('visitTimeSlot').notEmpty().withMessage('Time slot is required'),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { property: propertyId, visitDate, visitTimeSlot, notes } = req.body;

    // Check if property exists
    const property = await Property.findById(propertyId).populate('owner');
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // Check if user already has a pending visit for this property
    const existingVisit = await Booking.findOne({
      user: req.user.id,
      property: propertyId,
      bookingType: 'visit',
      status: { $in: ['pending', 'confirmed'] }
    });

    if (existingVisit) {
      return res.status(400).json({ message: 'You already have a pending visit request for this property' });
    }

    // Create visit booking
    const booking = new Booking({
      user: req.user.id,
      property: propertyId,
      owner: property.owner._id,
      bookingType: 'visit',
      visitDate: new Date(visitDate),
      visitTimeSlot,
      notes
    });

    await booking.save();
    await booking.populate(['user', 'property', 'owner']);

    // Create notification for the owner
    try {
      const notification = await Notification.create({
        user: property.owner._id,
        actor: req.user.id,
        type: 'visit_requested',
        title: 'New visit request',
        message: `${booking.user.name || 'A user'} requested a visit for ${booking.property.title} on ${new Date(booking.visitDate).toLocaleDateString()}${booking.visitTimeSlot ? ' at ' + booking.visitTimeSlot : ''}`,
        entity: { id: booking._id, model: 'Booking' },
        priority: 'normal'
      });

      // Emit to owner's room if Socket.IO available
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${property.owner._id.toString()}`).emit('notification:new', notification);
        io.to(`user:${property.owner._id.toString()}`).emit('visit:created', booking);
      }
    } catch (notifyErr) {
      console.warn('Failed to send visit notification:', notifyErr.message);
    }

    res.status(201).json({
      message: 'Visit scheduled successfully',
      booking
    });
  } catch (error) {
    console.error('Error scheduling visit:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Simple booking with deposit included (no token reservation)

// @route   POST /api/bookings/book
// @desc    Create a booking request including deposit amount
// @access  Private (tenant)
router.post('/book', [
  auth,
  authorize('tenant'),
  body('property').isMongoId().withMessage('Valid property ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { property: propertyId, moveInDate, moveOutDate } = req.body;
    const property = await Property.findById(propertyId).populate('owner');
    if (!property) return res.status(404).json({ message: 'Property not found' });

    // Default dates if not provided (1 month booking)
    const moveIn = moveInDate ? new Date(moveInDate) : new Date();
    const defaultOut = new Date(moveIn.getTime());
    defaultOut.setMonth(defaultOut.getMonth() + 1);
    const moveOut = moveOutDate ? new Date(moveOutDate) : defaultOut;
    const months = Math.max(1, Math.ceil((moveOut.getTime() - moveIn.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    const rent = Number(property.price) || 0;
    const rentTotal = rent * months;
    const deposit = Number(property.deposit) || 0;
    const totalAmount = rentTotal + deposit;

    const ownerId = property.owner?._id || property.owner;
    const booking = await Booking.create({
      user: req.user.id,
      property: property._id,
      owner: ownerId,
      bookingType: 'booking',
      moveInDate: moveIn,
      moveOutDate: moveOut,
      totalAmount,
      tokenAmount: 0,
      paymentStatus: 'pending',
      status: 'pending'
    });

    // Increment property analytics bookings count
    try {
      await Property.findByIdAndUpdate(property._id, { $inc: { 'analytics.bookings': 1 } });
    } catch {}

    // Notify owner via socket if connected
    try {
      const io = req.app.get('io');
      if (io && ownerId) {
        io.to(`user:${ownerId.toString()}`).emit('notification:new', {
          _id: `${booking._id}`,
          type: 'booking_requested',
          title: 'New Booking Request',
          message: `${req.user.name || 'A tenant'} requested to book ${property.title}`,
          createdAt: new Date().toISOString(),
          entity: { id: booking._id, model: 'Booking' }
        });
        io.to(`user:${ownerId.toString()}`).emit('booking:created', { bookingId: booking._id, propertyId: property._id });
      }
    } catch {}

    return res.status(201).json({ message: 'Booking created', booking, breakdown: { months, rent: rent, rentTotal, deposit, totalAmount } });
  } catch (error) {
    console.error('Error creating booking:', error);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
});

// @route   GET /api/bookings/user/:userId
// @desc    Get user's booking history
// @access  Private
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user is accessing their own bookings or is an owner
    if (req.user.id !== userId && req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const bookings = await Booking.find({ user: userId })
      .populate('property', 'title images price location')
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/bookings/property/:propertyId
// @desc    Get bookings for a property
// @access  Private (owner only)
router.get('/property/:propertyId', [auth, authorize('owner')], async (req, res) => {
  try {
    const { propertyId } = req.params;

    // Check if property belongs to the owner
    const property = await Property.findById(propertyId);
    if (!property || property.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const bookings = await Booking.find({ property: propertyId })
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (error) {
    console.error('Error fetching property bookings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/bookings/:id/status
// @desc    Update booking status
// @access  Private (owner only)
router.put('/:id/status', [
  auth,
  authorize('owner'),
  body('status').isIn(['pending', 'confirmed', 'cancelled', 'completed']).withMessage('Valid status is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status } = req.body;

    const booking = await Booking.findById(id).populate('property');
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check if property belongs to the owner
    if (booking.property.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    booking.status = status;
    await booking.save();

    res.json({
      message: 'Booking status updated successfully',
      booking
    });
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
