const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Property = require('../models/Property');
const Review = require('../models/Review');
const { auth, authorize } = require('../middleware/auth');


const router = express.Router();

// Get all properties with search and filters
router.get('/', [
  query('location').optional().trim(),
  query('minPrice').optional().isNumeric(),
  query('maxPrice').optional().isNumeric(),
  query('propertyType').optional().isIn(['1BHK', '2BHK', '3BHK', 'Studio', 'Penthouse', 'Villa']),
  query('features').optional(),
  query('facilities').optional(),
  query('availability').optional().isIn(['Available', 'Rented', 'Under Maintenance'])
], async (req, res) => {
  try {
    const {
      location,
      minPrice,
      maxPrice,
      propertyType,
      features,
      facilities,
      availability
    } = req.query;

    // Build filter object
    const filter = { isActive: true };

    if (location) {
      filter['location.city'] = { $regex: location, $options: 'i' };
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (propertyType) {
      filter.propertyType = propertyType;
    }

    if (features) {
      const featureArray = features.split(',');
      filter.features = { $in: featureArray };
    }

    if (facilities) {
      const facilityArray = facilities.split(',');
      filter.facilities = { $in: facilityArray };
    }

    if (availability) {
      filter.availability = availability;
    }

    // Get properties with owner information
    const properties = await Property.find(filter)
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 });

    // Calculate average ratings for each property
    const propertiesWithRatings = await Promise.all(
      properties.map(async (property) => {
        const reviews = await Review.find({ property: property._id, isActive: true });
        const averageRating = reviews.length > 0 
          ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
          : 0;
        
        return {
          ...property.toObject(),
          averageRating: Math.round(averageRating * 10) / 10,
          reviewCount: reviews.length
        };
      })
    );

    res.json(propertiesWithRatings);

  } catch (error) {
    console.error('Get properties error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Optional auth middleware for property views
const optionalAuth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } catch (error) {
      // Token invalid, continue as anonymous user
    }
  }
  next();
};

// Get single property by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate('owner', 'name email phone');

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // Track property view (only if user is authenticated and not the owner)
    const userId = req.user?._id;
    const userIP = req.ip || req.connection.remoteAddress;
    
    if (userId && property.owner._id.toString() !== userId.toString()) {
      // Check if this user has already viewed this property
      const alreadyViewed = property.viewedBy?.some(view => 
        view.user && view.user.toString() === userId.toString()
      );
      
      if (!alreadyViewed) {
        // Add new view record
        await Property.findByIdAndUpdate(req.params.id, {
          $push: {
            viewedBy: {
              user: userId,
              viewedAt: new Date(),
              ipAddress: userIP
            }
          },
          $inc: { 'analytics.views': 1 }
        });
      }
    } else if (!userId) {
      // For anonymous users, track by IP to avoid duplicate views
      const alreadyViewedByIP = property.viewedBy?.some(view => 
        view.ipAddress === userIP && 
        new Date() - new Date(view.viewedAt) < 24 * 60 * 60 * 1000 // Within 24 hours
      );
      
      if (!alreadyViewedByIP) {
        await Property.findByIdAndUpdate(req.params.id, {
          $push: {
            viewedBy: {
              viewedAt: new Date(),
              ipAddress: userIP
            }
          },
          $inc: { 'analytics.views': 1 }
        });
      }
    }

    // Get reviews for this property
    const reviews = await Review.find({ property: property._id, isActive: true })
      .populate('tenant', 'name')
      .sort({ createdAt: -1 });

    const averageRating = reviews.length > 0 
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
      : 0;

    res.json({
      ...property.toObject(),
      reviews,
      averageRating: Math.round(averageRating * 10) / 10,
      reviewCount: reviews.length
    });

  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Debug route to check user authorization
router.get('/debug/auth', auth, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      roleType: typeof req.user.role
    },
    isOwner: req.user.role === 'owner',
    message: 'User authentication debug info'
  });
});

// Create new property (Owner only)
router.post('/', [
  auth,
  authorize('owner'),
  body('title').trim().isLength({ min: 5 }).withMessage('Title must be at least 5 characters long'),
  body('description').trim().isLength({ min: 20 }).withMessage('Description must be at least 20 characters long'),
  body('price').isNumeric().withMessage('Price must be a number'),
  body('maintenance').optional().isFloat({ min: 0 }).withMessage('Maintenance must be a non-negative number'),
  body('deposit').optional().isFloat({ min: 0 }).withMessage('Deposit must be a non-negative number'),
  body('location.address').trim().notEmpty().withMessage('Address is required'),
  body('location.city').trim().notEmpty().withMessage('City is required'),
  body('location.state').trim().notEmpty().withMessage('State is required'),
  body('propertyType').isIn(['1BHK', '2BHK', '3BHK', 'Studio', 'Penthouse', 'Villa']).withMessage('Invalid property type'),
  body('area').isNumeric().withMessage('Area must be a number'),
  body('bedrooms').isNumeric().withMessage('Bedrooms must be a number'),
  body('bathrooms').isNumeric().withMessage('Bathrooms must be a number'),
  body('bachelorsAllowed').isBoolean().withMessage('Bachelors allowed must be a boolean'),
  body('furnishingStatus').isIn(['None', 'Half', 'Fully']).withMessage('Invalid furnishing status'),
  // Lease terms and FAQ
  body('leaseTerms').optional().isObject().withMessage('Lease terms must be an object'),
  body('leaseTerms.minimumDuration').optional().isString().trim(),
  body('leaseTerms.renewalTerms').optional().isString().trim(),
  body('faq').optional().isArray({ max: 10 }).withMessage('FAQ must be an array of up to 10 items'),
  body('faq.*.question').optional().isString().trim().notEmpty().withMessage('FAQ question is required'),
  body('faq.*.answer').optional().isString().trim().notEmpty().withMessage('FAQ answer is required'),
  // Note: Image validation is handled in custom logic below
], async (req, res) => {
  try {
    console.log('\n=== PROPERTY CREATION DEBUG START ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('User ID:', req.user._id);
    console.log('User Role:', req.user.role);
    console.log('Request Body:', JSON.stringify(req.body, null, 2));
    
    // Custom image validation
    const images = req.body.images || [];
    console.log('Images received:', images.length, 'images');
    console.log('Images array:', JSON.stringify(images, null, 2));
    
    if (!Array.isArray(images)) {
      console.log('❌ Images is not an array');
      return res.status(400).json({ 
        message: 'Images must be an array',
        errors: [{ field: 'images', message: 'Images must be provided as an array' }]
      });
    }
    
    if (images.length < 1) {
      console.log('❌ Not enough images:', images.length);
      return res.status(400).json({ 
        message: 'At least 1 image is required',
        errors: [{ field: 'images', message: 'Property must have at least 1 image' }]
      });
    }
    
    if (images.length > 6) {
      console.log('❌ Too many images:', images.length);
      return res.status(400).json({ 
        message: 'Maximum 6 images allowed',
        errors: [{ field: 'images', message: 'Property can have maximum 6 images' }]
      });
    }
    
    console.log('✅ Image validation passed:', images.length, 'images');
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Other validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }
    console.log('✅ All validation passed');

    console.log('Creating property object...');
    const propertyData = {
      ...req.body,
      owner: req.user._id
    };
    console.log('Property data to save:', JSON.stringify(propertyData, null, 2));
    
    const property = new Property(propertyData);
    console.log('Property object created, attempting to save...');
    
    // Validate the property before saving
    const validationError = property.validateSync();
    if (validationError) {
      console.log('❌ Property validation failed before save:', validationError.message);
      throw validationError;
    }
    
    await property.save();
    console.log('✅ Property saved successfully with ID:', property._id);

    // Populate owner information for real-time update
    const populatedProperty = await Property.findById(property._id)
      .populate('owner', 'name email phone');

    // Emit real-time update to all tenants (with error handling)
    try {
      const io = req.app.get('io');
      if (io) {
        io.to('tenants').emit('new-property', {
          ...populatedProperty.toObject(),
          averageRating: 0,
          reviewCount: 0
        });

        // Emit to specific owner
        io.to(`owner-${req.user._id}`).emit('property-added', populatedProperty);
      }
    } catch (socketError) {
      console.warn('Socket.io error (non-critical):', socketError.message);
      // Continue without socket.io - this is not critical for property creation
    }

    res.status(201).json({
      message: 'Property created successfully',
      property: populatedProperty
    });

  } catch (error) {
    console.error('\n=== PROPERTY CREATION ERROR ===');
    console.error('Timestamp:', new Date().toISOString());
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Log request details for debugging
    console.error('Request body that caused error:', JSON.stringify(req.body, null, 2));
    console.error('User info:', JSON.stringify({ id: req.user._id, role: req.user.role }, null, 2));
    
    if (error.name === 'ValidationError') {
      console.error('❌ MongoDB Validation errors:');
      Object.keys(error.errors).forEach(key => {
        console.error(`  - ${key}: ${error.errors[key].message}`);
        console.error(`    Value: ${error.errors[key].value}`);
        console.error(`    Kind: ${error.errors[key].kind}`);
      });
      console.error('=== END ERROR LOG ===\n');
      return res.status(400).json({ 
        message: 'Property validation failed', 
        errors: Object.keys(error.errors).map(key => ({
          field: key,
          message: error.errors[key].message,
          value: error.errors[key].value
        })),
        debug: 'Check server logs for detailed error information'
      });
    }
    
    if (error.name === 'MongoServerError') {
      console.error('❌ MongoDB server error:');
      console.error('Error code:', error.code);
      console.error('Error details:', error.keyPattern);
      console.error('=== END ERROR LOG ===\n');
      return res.status(500).json({
        message: 'Database error',
        debug: 'MongoDB server error - check server logs'
      });
    }
    
    console.error('❌ Unexpected error during property creation');
    console.error('=== END ERROR LOG ===\n');
    
    res.status(500).json({ 
      message: 'Server error during property creation',
      debug: {
        error: error.name,
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Update property (Owner only)
router.put('/:id', [
  auth,
  authorize('owner'),
  body('title').optional().trim().isLength({ min: 5 }).withMessage('Title must be at least 5 characters long'),
  body('description').optional().trim().isLength({ min: 20 }).withMessage('Description must be at least 20 characters long'),
  body('price').optional().isNumeric().withMessage('Price must be a number'),
  body('maintenance').optional().isFloat({ min: 0 }).withMessage('Maintenance must be a non-negative number'),
  body('deposit').optional().isFloat({ min: 0 }).withMessage('Deposit must be a non-negative number'),
  body('location.address').optional().trim().notEmpty().withMessage('Address is required'),
  body('location.city').optional().trim().notEmpty().withMessage('City is required'),
  body('location.state').optional().trim().notEmpty().withMessage('State is required'),
  body('propertyType').optional().isIn(['1BHK', '2BHK', '3BHK', 'Studio', 'Penthouse', 'Villa']).withMessage('Invalid property type'),
  body('area').optional().isNumeric().withMessage('Area must be a number'),
  body('bedrooms').optional().isNumeric().withMessage('Bedrooms must be a number'),
  body('bathrooms').optional().isNumeric().withMessage('Bathrooms must be a number'),
  body('bachelorsAllowed').optional().isBoolean().withMessage('Bachelors allowed must be a boolean'),
  body('furnishingStatus').optional().isIn(['None', 'Half', 'Fully']).withMessage('Invalid furnishing status'),
  body('features').optional().isArray().withMessage('Features must be an array'),
  body('facilities').optional().isArray().withMessage('Facilities must be an array'),
  // Lease terms and FAQ
  body('leaseTerms').optional().isObject().withMessage('Lease terms must be an object'),
  body('leaseTerms.minimumDuration').optional().isString().trim(),
  body('leaseTerms.renewalTerms').optional().isString().trim(),
  body('faq').optional().isArray({ max: 10 }).withMessage('FAQ must be an array of up to 10 items'),
  body('faq.*.question').optional().isString().trim().notEmpty().withMessage('FAQ question is required'),
  body('faq.*.answer').optional().isString().trim().notEmpty().withMessage('FAQ answer is required'),
  body('images').optional().isArray({ min: 1, max: 6 }).withMessage('Property must have between 1 and 6 images'),
  body('images.*').optional().custom((value) => {
    if (typeof value !== 'string') throw new Error('Each image must be a string');
    const isValidURL = /^https?:\/\/.+/.test(value);
    const isValidDataURL = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/.test(value);
    if (!isValidURL && !isValidDataURL) {
      throw new Error('Each image must be a valid URL or base64 data URL');
    }
    return true;
  }),
], async (req, res) => {
  try {
    console.log('\n=== PROPERTY UPDATE DEBUG START ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('User ID:', req.user._id);
    console.log('User Role:', req.user.role);
    console.log('Request Body:', JSON.stringify(req.body, null, 2));

    const property = await Property.findById(req.params.id);
    if (!property) {
      console.log('❌ Property not found');
      return res.status(404).json({ message: 'Property not found' });
    }
    // Check if user owns this property
    if (property.owner.toString() !== req.user._id.toString()) {
      console.log('❌ Not authorized to update this property');
      return res.status(403).json({ message: 'Not authorized to update this property' });
    }

    // Custom image validation (for PATCH/PUT)
    if (req.body.images) {
      const images = req.body.images;
      console.log('Images received:', images.length, 'images');
      if (!Array.isArray(images)) {
        console.log('❌ Images is not an array');
        return res.status(400).json({ 
          message: 'Images must be an array',
          errors: [{ field: 'images', message: 'Images must be an array' }]
        });
      }
      if (images.length < 1) {
        console.log('❌ At least 1 image is required');
        return res.status(400).json({ 
          message: 'At least 1 image is required',
          errors: [{ field: 'images', message: 'Property must have at least 1 image' }]
        });
      }
      if (images.length > 6) {
        console.log('❌ Too many images:', images.length);
        return res.status(400).json({ 
          message: 'Maximum 6 images allowed',
          errors: [{ field: 'images', message: 'Property can have maximum 6 images' }]
        });
      }
      for (const img of images) {
        const isValidURL = /^https?:\/\/.+/.test(img);
        const isValidDataURL = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/.test(img);
        if (!isValidURL && !isValidDataURL) {
          console.log('❌ Invalid image format:', img);
          return res.status(400).json({ 
            message: 'Each image must be a valid URL or base64 data URL',
            errors: [{ field: 'images', message: 'Invalid image format' }]
          });
        }
      }
      console.log('✅ Image validation passed:', images.length, 'images');
    }

    // Validate other fields
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }
    console.log('✅ All validation passed');

    // Update property
    const updatedProperty = await Property.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('owner', 'name email phone');

    // Emit real-time update to all tenants and owner (with error handling)
    try {
      const io = req.app.get('io');
      if (io) {
        io.to('tenants').emit('property-updated', updatedProperty);
        io.to(`owner-${req.user._id}`).emit('property-updated', updatedProperty);
      }
    } catch (socketError) {
      console.warn('Socket.io error (non-critical):', socketError.message);
      // Continue without socket.io - this is not critical for property update
    }

    res.json({
      message: 'Property updated successfully',
      property: updatedProperty
    });

  } catch (error) {
    console.error('Update property error:', error);
    res.status(500).json({ message: 'Server error during property update' });
  }
});

// Delete property (Owner only)
router.delete('/:id', [auth, authorize('owner')], async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // Check if user owns this property
    if (property.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this property' });
    }

    // Soft delete
    property.isActive = false;
    await property.save();

    res.json({ message: 'Property deleted successfully' });

  } catch (error) {
    console.error('Delete property error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get properties by owner
router.get('/owner/my-properties', [auth, authorize('owner')], async (req, res) => {
  try {
    const properties = await Property.find({ owner: req.user._id, isActive: true })
      .sort({ createdAt: -1 });

    // Calculate average ratings for each property
    const propertiesWithRatings = await Promise.all(
      properties.map(async (property) => {
        const reviews = await Review.find({ property: property._id, isActive: true });
        const averageRating = reviews.length > 0 
          ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
          : 0;
        
        return {
          ...property.toObject(),
          averageRating: Math.round(averageRating * 10) / 10,
          reviewCount: reviews.length
        };
      })
    );

    res.json(propertiesWithRatings);

  } catch (error) {
    console.error('Get owner properties error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



module.exports = router; 