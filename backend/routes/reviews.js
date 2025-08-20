const express = require('express');
const { body, validationResult } = require('express-validator');
const Review = require('../models/Review');
const Property = require('../models/Property');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// Submit a review (Tenant only)
router.post('/', [
  auth,
  authorize('tenant'),
  body('propertyId').isMongoId().withMessage('Valid property ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').trim().isLength({ min: 10, max: 500 }).withMessage('Comment must be between 10 and 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { propertyId, rating, comment } = req.body;

    // Check if property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // Check if user has already reviewed this property
    const existingReview = await Review.findOne({
      property: propertyId,
      tenant: req.user._id
    });

    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this property' });
    }

    // Create new review
    const review = new Review({
      property: propertyId,
      tenant: req.user._id,
      owner: property.owner,
      rating,
      comment
    });

    await review.save();

    // Populate tenant name for response
    await review.populate('tenant', 'name');

    res.status(201).json({
      message: 'Review submitted successfully',
      review
    });

  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a review (Tenant only)
router.put('/:id', [
  auth,
  authorize('tenant'),
  body('rating').optional().isInt({ min: 1, max: 5 }),
  body('comment').optional().trim().isLength({ min: 10, max: 500 })
], async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Check if user owns this review
    if (review.tenant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this review' });
    }

    const updatedReview = await Review.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('tenant', 'name');

    res.json({
      message: 'Review updated successfully',
      review: updatedReview
    });

  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a review (Tenant only)
router.delete('/:id', [auth, authorize('tenant')], async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Check if user owns this review
    if (review.tenant.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this review' });
    }

    // Soft delete
    review.isActive = false;
    await review.save();

    res.json({ message: 'Review deleted successfully' });

  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get reviews by tenant (Tenant's own reviews)
router.get('/tenant/my-reviews', [auth, authorize('tenant')], async (req, res) => {
  try {
    const reviews = await Review.find({ tenant: req.user._id, isActive: true })
      .populate('property', 'title location')
      .populate('owner', 'name')
      .sort({ createdAt: -1 });

    res.json(reviews);

  } catch (error) {
    console.error('Get tenant reviews error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get reviews for owner's properties
router.get('/owner/my-property-reviews', [auth, authorize('owner')], async (req, res) => {
  try {
    const reviews = await Review.find({ owner: req.user._id, isActive: true })
      .populate('property', 'title location')
      .populate('tenant', 'name')
      .sort({ createdAt: -1 });

    res.json(reviews);

  } catch (error) {
    console.error('Get owner property reviews error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get reviews for a specific property
router.get('/property/:propertyId', async (req, res) => {
  try {
    const reviews = await Review.find({ 
      property: req.params.propertyId, 
      isActive: true 
    })
      .populate('tenant', 'name')
      .sort({ createdAt: -1 });

    res.json(reviews);

  } catch (error) {
    console.error('Get property reviews error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 