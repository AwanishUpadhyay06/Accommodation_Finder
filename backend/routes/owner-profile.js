const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Property = require('../models/Property');
const Booking = require('../models/Booking');
const Enquiry = require('../models/Enquiry');
const Favorite = require('../models/Favorite');
const Review = require('../models/Review');

const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/agreements/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and documents are allowed'));
    }
  }
});

// Get owner profile info
router.get('/info', [auth, authorize('owner')], async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    console.error('Error fetching owner profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update owner profile info
router.put('/info', [auth, authorize('owner')], async (req, res) => {
  try {
    const { name, email, phone, address, businessName, businessLicense } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, email, phone, address, businessName, businessLicense },
      { new: true, runValidators: true }
    ).select('-password');
    
    res.json(user);
  } catch (error) {
    console.error('Error updating owner profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get owner's properties/listings
router.get('/listings', [auth, authorize('owner')], async (req, res) => {
  try {
    const properties = await Property.find({ 
      owner: req.user._id,
      isActive: true,
      isVisible: true
    })
      .populate('reviews', 'rating comment user createdAt')
      .sort({ createdAt: -1 });
    
    res.json(properties);
  } catch (error) {
    console.error('Error fetching owner listings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get booking requests for owner
router.get('/booking-requests', [auth, authorize('owner')], async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.user._id }).select('_id');
    const propertyIds = properties.map(p => p._id);
    
    const bookings = await Booking.find({ 
      property: { $in: propertyIds }
    })
      .populate('property', 'title images location rent')
      .populate('tenant', 'name email phone')
      .sort({ createdAt: -1 });
    
    res.json(bookings);
  } catch (error) {
    console.error('Error fetching booking requests:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get visit requests for owner
router.get('/visit-requests', [auth, authorize('owner')], async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.user._id }).select('_id');
    const propertyIds = properties.map(p => p._id);
    
    const visits = await Booking.find({ 
      property: { $in: propertyIds },
      type: 'visit'
    })
      .populate('property', 'title images location rent')
      .populate('tenant', 'name email phone')
      .sort({ visitDate: 1 });
    
    res.json(visits);
  } catch (error) {
    console.error('Error fetching visit requests:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get enquiries for owner
router.get('/enquiries', [auth, authorize('owner')], async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.user._id }).select('_id');
    const propertyIds = properties.map(p => p._id);
    
    const enquiries = await Enquiry.find({ 
      property: { $in: propertyIds }
    })
      .populate('property', 'title images location rent')
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 });
    
    res.json(enquiries);
  } catch (error) {
    console.error('Error fetching enquiries:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reply to enquiry
router.post('/enquiries/:id/reply', [auth, authorize('owner')], async (req, res) => {
  try {
    const { message } = req.body;
    const enquiry = await Enquiry.findById(req.params.id)
      .populate('property', 'owner');
    
    if (!enquiry || enquiry.property.owner.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Enquiry not found' });
    }
    
    enquiry.replies.push({
      message,
      sender: req.user._id,
      senderType: 'owner',
      timestamp: new Date()
    });
    
    await enquiry.save();
    
    // Create notification for tenant
    await Notification.create({
      recipient: enquiry.user,
      sender: req.user._id,
      property: enquiry.property._id,
      type: 'enquiry_reply',
      title: 'Reply to your enquiry',
      message: `Owner replied to your enquiry about ${enquiry.property.title}`,
      data: { enquiryId: enquiry._id }
    });
    
    res.json(enquiry);
  } catch (error) {
    console.error('Error replying to enquiry:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get interested tenants (users who favorited, enquired, or booked)
router.get('/interested-tenants', [auth, authorize('owner')], async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.user._id }).select('_id');
    const propertyIds = properties.map(p => p._id);
    
    // Get all interactions
    const [favorites, enquiries, bookings] = await Promise.all([
      Favorite.find({ property: { $in: propertyIds } })
        .populate('user', 'name email phone')
        .populate('property', 'title'),
      Enquiry.find({ property: { $in: propertyIds } })
        .populate('user', 'name email phone')
        .populate('property', 'title'),
      Booking.find({ property: { $in: propertyIds } })
        .populate('tenant', 'name email phone')
        .populate('property', 'title')
    ]);
    
    // Combine and deduplicate users
    const tenantMap = new Map();
    
    favorites.forEach(fav => {
      const userId = fav.user._id.toString();
      if (!tenantMap.has(userId)) {
        tenantMap.set(userId, {
          user: fav.user,
          interactions: []
        });
      }
      tenantMap.get(userId).interactions.push({
        type: 'favorite',
        property: fav.property,
        date: fav.createdAt
      });
    });
    
    enquiries.forEach(enq => {
      const userId = enq.user._id.toString();
      if (!tenantMap.has(userId)) {
        tenantMap.set(userId, {
          user: enq.user,
          interactions: []
        });
      }
      tenantMap.get(userId).interactions.push({
        type: 'enquiry',
        property: enq.property,
        date: enq.createdAt,
        subject: enq.subject
      });
    });
    
    bookings.forEach(book => {
      const userId = book.tenant._id.toString();
      if (!tenantMap.has(userId)) {
        tenantMap.set(userId, {
          user: book.tenant,
          interactions: []
        });
      }
      tenantMap.get(userId).interactions.push({
        type: 'booking',
        property: book.property,
        date: book.createdAt,
        status: book.status
      });
    });
    
    const interestedTenants = Array.from(tenantMap.values());
    res.json(interestedTenants);
  } catch (error) {
    console.error('Error fetching interested tenants:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get tenant details with documents (for viewing tenant profile)
router.get('/tenant/:tenantId', [auth, authorize('owner')], async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Verify this tenant has interacted with owner's properties
    const properties = await Property.find({ owner: req.user._id }).select('_id');
    const propertyIds = properties.map(p => p._id);
    
    const hasInteraction = await Promise.all([
      Favorite.findOne({ user: tenantId, property: { $in: propertyIds } }),
      Enquiry.findOne({ user: tenantId, property: { $in: propertyIds } }),
      Booking.findOne({ tenant: tenantId, property: { $in: propertyIds } })
    ]);
    
    if (!hasInteraction.some(Boolean)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const tenant = await User.findById(tenantId).select('-password');
    res.json(tenant);
  } catch (error) {
    console.error('Error fetching tenant details:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get analytics for owner's properties
router.get('/analytics', [auth, authorize('owner')], async (req, res) => {
  try {
    const properties = await Property.find({ 
      owner: req.user._id,
      isActive: true,
      isVisible: true
    });
    const propertyIds = properties.map(p => p._id);
    
    // Get real analytics data from database
    const [bookings, enquiries, favorites, reviews] = await Promise.all([
      Booking.find({ property: { $in: propertyIds } }),
      Enquiry.find({ property: { $in: propertyIds } }),
      Favorite.find({ property: { $in: propertyIds } }),
      Review.find({ property: { $in: propertyIds } })
    ]);
    
    // Calculate total views from viewedBy arrays
    const totalViews = properties.reduce((sum, p) => sum + (p.viewedBy?.length || 0), 0);
    const totalBookings = bookings.length;
    const totalEnquiries = enquiries.length;
    const totalFavorites = favorites.length;
    const totalReviews = reviews.length;
    
    // Calculate conversion rate (bookings / views)
    const conversionRate = totalViews > 0 ? ((totalBookings / totalViews) * 100).toFixed(2) : 0;
    
    // Calculate average rating
    const averageRating = reviews.length > 0 
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : 0;
    
    // Calculate total revenue from bookings
    const totalRevenue = bookings.reduce((sum, booking) => {
      return sum + (booking.tokenAmount || 0);
    }, 0);
    
    // Property-wise analytics
    const propertyAnalytics = await Promise.all(properties.map(async (property) => {
      const propertyBookings = bookings.filter(b => b.property.toString() === property._id.toString());
      const propertyEnquiries = enquiries.filter(e => e.property.toString() === property._id.toString());
      const propertyFavorites = favorites.filter(f => f.property.toString() === property._id.toString());
      const propertyReviews = reviews.filter(r => r.property.toString() === property._id.toString());
      
      return {
        property: {
          _id: property._id,
          title: property.title,
          location: property.location
        },
        views: property.viewedBy?.length || 0,
        enquiries: propertyEnquiries.length,
        bookings: propertyBookings.length,
        favorites: propertyFavorites.length,
        reviews: propertyReviews.length,
        revenue: propertyBookings.reduce((sum, b) => sum + (b.tokenAmount || 0), 0),
        averageRating: propertyReviews.length > 0 
          ? (propertyReviews.reduce((sum, r) => sum + r.rating, 0) / propertyReviews.length).toFixed(1)
          : 0
      };
    }));
    
    const analytics = {
      totalProperties: properties.length,
      totalViews,
      totalEnquiries,
      totalBookings,
      totalFavorites,
      totalReviews,
      conversionRate: parseFloat(conversionRate),
      averageRating: parseFloat(averageRating),
      totalRevenue,
      propertyAnalytics
    };
    
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get payment history for owner
router.get('/payments', [auth, authorize('owner')], async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.user._id }).select('_id');
    const propertyIds = properties.map(p => p._id);
    
    const payments = await Booking.find({ 
      property: { $in: propertyIds },
      paymentStatus: { $in: ['paid', 'partial'] }
    })
      .populate('property', 'title location')
      .populate('tenant', 'name email')
      .select('property tenant tokenAmount paymentStatus paymentDate createdAt')
      .sort({ paymentDate: -1 });
    
    res.json(payments);
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload rental agreement
router.post('/agreements', [auth, authorize('owner'), upload.single('agreement')], async (req, res) => {
  try {
    const { propertyId, tenantId, agreementType } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    // Verify property ownership
    const property = await Property.findOne({ _id: propertyId, owner: req.user._id });
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }
    
    const agreement = {
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      property: propertyId,
      tenant: tenantId,
      type: agreementType,
      uploadDate: new Date()
    };
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $push: { rentalAgreements: agreement } },
      { new: true }
    ).select('-password');
    
    res.json({ message: 'Agreement uploaded successfully', agreement });
  } catch (error) {
    console.error('Error uploading agreement:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get rental agreements
router.get('/agreements', [auth, authorize('owner')], async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('rentalAgreements.property', 'title location')
      .populate('rentalAgreements.tenant', 'name email')
      .select('rentalAgreements');
    
    res.json(user.rentalAgreements || []);
  } catch (error) {
    console.error('Error fetching agreements:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get notifications for owner
router.get('/notifications', [auth, authorize('owner')], async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('property', 'title location')
      .populate('sender', 'name')
      .sort({ createdAt: -1 })
      .limit(50);
    
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', [auth, authorize('owner')], async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    res.json(notification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update notification preferences
router.put('/settings/notifications', [auth, authorize('owner')], async (req, res) => {
  try {
    const { emailNotifications, smsNotifications, pushNotifications } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { 
        notificationPreferences: {
          email: emailNotifications,
          sms: smsNotifications,
          push: pushNotifications
        }
      },
      { new: true }
    ).select('-password');
    
    res.json(user);
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password
router.put('/settings/password', [auth, authorize('owner')], async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const bcrypt = require('bcryptjs');
    
    const user = await User.findById(req.user._id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    await User.findByIdAndUpdate(req.user._id, { password: hashedPassword });
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete account
router.delete('/account', [auth, authorize('owner')], async (req, res) => {
  try {
    const { password } = req.body;
    const bcrypt = require('bcryptjs');
    
    const user = await User.findById(req.user._id);
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(400).json({ message: 'Password is incorrect' });
    }
    
    // Delete related data
    await Promise.all([
      Property.deleteMany({ owner: req.user._id }),
      Notification.deleteMany({ recipient: req.user._id }),
      User.findByIdAndDelete(req.user._id)
    ]);
    
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
