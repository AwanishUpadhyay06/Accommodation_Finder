const mongoose = require('mongoose');

const availabilitySlotSchema = new mongoose.Schema({
  dayOfWeek: {
    type: Number, // 0-6 (Sunday-Saturday)
    required: true,
    min: 0,
    max: 6
  },
  startTime: {
    type: String, // Format: "HH:MM" in 24-hour format
    required: true
  },
  endTime: {
    type: String, // Format: "HH:MM" in 24-hour format
    required: true
  }
});

const expertSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  bio: {
    type: String,
    trim: true
  },
  expertise: [{
    type: String,
    required: true
  }],
  experience: {
    type: Number, // years of experience
    min: 0
  },
  languages: [{
    type: String
  }],
  availability: [availabilitySlotSchema],
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalRatings: {
    type: Number,
    default: 0
  },
  consultationFee: {
    type: Number,
    default: 0,
    min: 0
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  consultationCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for search functionality
expertSchema.index({ expertise: 1, isAvailable: 1, rating: -1 });

// Virtual for calculating average rating
expertSchema.virtual('averageRating').get(function() {
  return this.totalRatings > 0 ? (this.rating / this.totalRatings).toFixed(1) : 0;
});

module.exports = mongoose.model('Expert', expertSchema);
