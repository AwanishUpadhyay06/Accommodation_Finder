const express = require('express');
const router = express.Router();
const Favorite = require('../models/Favorite');
const Property = require('../models/Property');
const { auth } = require('../middleware/auth');

// @route   POST /api/favorites/:propertyId
// @desc    Add property to favorites
// @access  Private
router.post('/:propertyId', auth, async (req, res) => {
  try {
    const { propertyId } = req.params;

    // Check if property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // Check if already favorited
    const existingFavorite = await Favorite.findOne({
      user: req.user.id,
      property: propertyId
    });

    if (existingFavorite) {
      return res.status(400).json({ message: 'Property already in favorites' });
    }

    // Create favorite
    const favorite = new Favorite({
      user: req.user.id,
      property: propertyId
    });

    await favorite.save();

    res.status(201).json({
      message: 'Property added to favorites',
      favorite
    });
  } catch (error) {
    console.error('Error adding to favorites:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/favorites/:propertyId
// @desc    Remove property from favorites
// @access  Private
router.delete('/:propertyId', auth, async (req, res) => {
  try {
    const { propertyId } = req.params;

    const favorite = await Favorite.findOneAndDelete({
      user: req.user.id,
      property: propertyId
    });

    if (!favorite) {
      return res.status(404).json({ message: 'Favorite not found' });
    }

    res.json({ message: 'Property removed from favorites' });
  } catch (error) {
    console.error('Error removing from favorites:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/favorites
// @desc    Get user's favorite properties
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const favorites = await Favorite.find({ user: req.user.id })
      .populate({
        path: 'property',
        populate: {
          path: 'owner',
          select: 'name email phone'
        }
      })
      .sort({ createdAt: -1 });

    res.json(favorites);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/favorites/check/:propertyId
// @desc    Check if property is favorited by user
// @access  Private
router.get('/check/:propertyId', auth, async (req, res) => {
  try {
    const { propertyId } = req.params;

    const favorite = await Favorite.findOne({
      user: req.user.id,
      property: propertyId
    });

    res.json({ isFavorite: !!favorite });
  } catch (error) {
    console.error('Error checking favorite status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
