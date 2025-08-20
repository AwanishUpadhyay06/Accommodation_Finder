const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Property = require('../models/Property');
const Booking = require('../models/Booking');
const Enquiry = require('../models/Enquiry');
const Favorite = require('../models/Favorite');
const Review = require('../models/Review');
const Notification = require('../models/Notification');

const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/documents/');
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

// Get tenant profile info
router.get('/info', [auth, authorize('tenant')], async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    console.error('Error fetching tenant profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update tenant profile info
router.put('/info', [auth, authorize('tenant')], async (req, res) => {
  try {
    const { name, email, phone, address, dateOfBirth, occupation } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, email, phone, address, dateOfBirth, occupation },
      { new: true, runValidators: true }
    ).select('-password');
    
    res.json(user);
  } catch (error) {
    console.error('Error updating tenant profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get tenant bookings
router.get('/bookings', [auth, authorize('tenant')], async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id, bookingType: 'booking' })
      .populate('property', 'title images location rent price')
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 });
    
    res.json(bookings);
  } catch (error) {
    console.error('Error fetching tenant bookings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get tenant visits
router.get('/visits', [auth, authorize('tenant')], async (req, res) => {
  try {
    const visits = await Booking.find({ 
      user: req.user._id,
      bookingType: 'visit'
    })
      .populate('property', 'title images location rent price')
      .populate('owner', 'name email phone')
      .sort({ visitDate: 1 });
    
    res.json(visits);
  } catch (error) {
    console.error('Error fetching tenant visits:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get tenant favorites
router.get('/favorites', [auth, authorize('tenant')], async (req, res) => {
  try {
    const favorites = await Favorite.find({ user: req.user._id })
      .populate('property', 'title images location rent averageRating reviewCount')
      .sort({ createdAt: -1 });
    
    res.json(favorites);
  } catch (error) {
    console.error('Error fetching tenant favorites:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get tenant enquiries
router.get('/enquiries', [auth, authorize('tenant')], async (req, res) => {
  try {
    const enquiries = await Enquiry.find({ user: req.user._id })
      .populate('property', 'title images location rent')
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 });
    
    res.json(enquiries);
  } catch (error) {
    console.error('Error fetching tenant enquiries:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get tenant reviews
router.get('/reviews', [auth, authorize('tenant')], async (req, res) => {
  try {
    const reviews = await Review.find({ user: req.user._id })
      .populate('property', 'title images location')
      .sort({ createdAt: -1 });
    
    res.json(reviews);
  } catch (error) {
    console.error('Error fetching tenant reviews:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload documents
router.post('/documents', [auth, authorize('tenant'), upload.array('documents', 5)], async (req, res) => {
  try {
    const { documentType } = req.body;
    const files = req.files;
    
    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }
    
    const documents = files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      type: documentType,
      uploadDate: new Date()
    }));
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $push: { documents: { $each: documents } } },
      { new: true }
    ).select('-password');
    
    res.json({ message: 'Documents uploaded successfully', documents: user.documents });
  } catch (error) {
    console.error('Error uploading documents:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get documents
router.get('/documents', [auth, authorize('tenant')], async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('documents');
    res.json(user.documents || []);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete document
router.delete('/documents/:documentId', [auth, authorize('tenant')], async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { documents: { _id: documentId } } },
      { new: true }
    ).select('documents');
    
    res.json({ message: 'Document deleted successfully', documents: user.documents });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get payment history
router.get('/payments', [auth, authorize('tenant')], async (req, res) => {
  try {
    const bookings = await Booking.find({ 
      user: req.user._id,
      paymentStatus: { $in: ['paid', 'partial'] }
    })
      .populate('property', 'title location')
      .select('property tokenAmount paymentStatus paymentDate createdAt')
      .sort({ paymentDate: -1 });
    
    res.json(bookings);
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



// Update notification preferences
router.put('/settings/notifications', [auth, authorize('tenant')], async (req, res) => {
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
router.put('/settings/password', [auth, authorize('tenant')], async (req, res) => {
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
router.delete('/account', [auth, authorize('tenant')], async (req, res) => {
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
      Booking.deleteMany({ tenant: req.user._id }),
      Enquiry.deleteMany({ user: req.user._id }),
      Favorite.deleteMany({ user: req.user._id }),
      Review.deleteMany({ user: req.user._id }),
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
