const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Property = require('../models/Property');
const Booking = require('../models/Booking');
const Enquiry = require('../models/Enquiry');
const Favorite = require('../models/Favorite');

const { auth, authorize } = require('../middleware/auth');

// @route   GET /api/owner/analytics/:propertyId
// @desc    Get analytics for a specific property
// @access  Private (Owner only)
router.get('/analytics/:propertyId', [auth, authorize('owner')], async (req, res) => {
  try {
    const property = await Property.findOne({ 
      _id: req.params.propertyId, 
      owner: req.user.id 
    });

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // Get interested users (favorites, enquiries, bookings)
    const [favorites, enquiries, bookings] = await Promise.all([
      Favorite.find({ property: req.params.propertyId }).populate('user', 'name email phone'),
      Enquiry.find({ property: req.params.propertyId }).populate('user', 'name email phone'),
      Booking.find({ property: req.params.propertyId }).populate('user', 'name email phone')
    ]);

    // Calculate conversion rate
    const totalViews = property.analytics.views || 0;
    const totalBookings = property.analytics.bookings || 0;
    const conversionRate = totalViews > 0 ? ((totalBookings / totalViews) * 100).toFixed(2) : 0;

    res.json({
      property: {
        id: property._id,
        title: property.title,
        analytics: property.analytics,
        tokenAmountReceived: property.tokenAmountReceived,
        conversionRate: parseFloat(conversionRate)
      },
      interestedUsers: {
        favorites: favorites.map(fav => ({
          ...fav.user.toObject(),
          type: 'favorite',
          date: fav.createdAt
        })),
        enquiries: enquiries.map(enq => ({
          ...enq.user.toObject(),
          type: 'enquiry',
          date: enq.createdAt,
          subject: enq.subject,
          message: enq.message,
          status: enq.status
        })),
        bookings: bookings.map(book => ({
          ...book.user.toObject(),
          type: book.bookingType,
          date: book.createdAt,
          status: book.status,
          visitDate: book.visitDate,
          visitTimeSlot: book.visitTimeSlot,
          bookingId: book._id,
          moveInDate: book.moveInDate,
          moveOutDate: book.moveOutDate,
          totalAmount: book.totalAmount
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching property analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



// @route   PUT /api/owner/booking/:id/respond
// @desc    Respond to booking request (Accept/Reject)
// @access  Private (Owner only)
router.put('/booking/:id/respond', [
  auth,
  authorize('owner'),
  body('status').isIn(['confirmed', 'rejected']),
  body('message').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, message } = req.body;

    // Find booking and verify ownership
    const booking = await Booking.findById(req.params.id).populate('property');
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.property.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update booking status
    booking.status = status;
    booking.ownerResponse = message || '';
    booking.respondedAt = new Date();
    await booking.save();

    // Create notification for user
    await Notification.create({
      recipient: booking.user,
      sender: req.user.id,
      property: booking.property._id,
      type: status === 'confirmed' ? 'booking_confirmed' : 'booking_rejected',
      title: `Booking ${status}`,
      message: `Your ${booking.bookingType} request has been ${status}${message ? ': ' + message : ''}`,
      data: { bookingId: booking._id }
    });

    res.json(booking);
  } catch (error) {
    console.error('Error responding to booking:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/owner/property/:id/visibility
// @desc    Toggle property visibility
// @access  Private (Owner only)
router.put('/property/:id/visibility', [auth, authorize('owner')], async (req, res) => {
  try {
    const { isVisible } = req.body;

    const property = await Property.findOneAndUpdate(
      { _id: req.params.id, owner: req.user.id },
      { isVisible: !!isVisible },
      { new: true }
    );

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    res.json({ message: 'Visibility updated', property });
  } catch (error) {
    console.error('Error updating property visibility:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/owner/dashboard-summary
// @desc    Get owner dashboard summary
// @access  Private (Owner only)
router.get('/dashboard-summary', [auth, authorize('owner')], async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.user.id });
    
    const summary = {
      totalProperties: properties.length,
      activeProperties: properties.filter(p => p.isActive && p.isVisible).length,
      totalViews: properties.reduce((sum, p) => sum + (p.analytics.views || 0), 0),
      totalBookings: properties.reduce((sum, p) => sum + (p.analytics.bookings || 0), 0),
      totalTokenReceived: properties.reduce((sum, p) => sum + (p.tokenAmountReceived || 0), 0),
      recentActivity: {
        enquiries: await Enquiry.countDocuments({ 
          property: { $in: properties.map(p => p._id) },
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }),
        bookings: await Booking.countDocuments({ 
          property: { $in: properties.map(p => p._id) },
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        })
      }
    };

    res.json(summary);
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
