const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  // Monthly maintenance charges (optional)
  maintenance: {
    type: Number,
    min: 0,
    default: 0
  },
  deposit: {
    type: Number,
    required: true,
    min: 0,
    default: function() {
      return this.price * 2; // Default to 2x monthly rent
    }
  },
  location: {
    address: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    state: {
      type: String,
      required: true,
      trim: true
    },
    zipCode: {
      type: String,
      trim: true
    }
  },
  propertyType: {
    type: String,
    enum: ['1BHK', '2BHK', '3BHK', 'Studio', 'Penthouse', 'Villa'],
    required: true
  },
  features: [{
    type: String,
    enum: ['WiFi', 'AC', 'Heating', 'Balcony', 'Garden', 'Terrace', 'Furnished', 'Unfurnished', 'Parking', 'Security']
  }],
  facilities: [{
    type: String,
    enum: ['Gym', 'Swimming Pool', 'Playground', 'Garden', 'Lift', 'Power Backup', 'Security', 'Parking', 'CCTV', 'Maintenance']
  }],
  bachelorsAllowed: {
    type: Boolean,
    default: false
  },
  furnishingStatus: {
    type: String,
    enum: ['None', 'Half', 'Fully'],
    default: 'None'
  },
  images: [{
    type: String,
    trim: true
  }],
  availability: {
    type: String,
    enum: ['Available', 'Rented', 'Under Maintenance'],
    default: 'Available'
  },
  availabilityDate: {
    type: Date,
    default: Date.now
  },
  area: {
    type: Number,
    required: true,
    min: 0
  },
  bedrooms: {
    type: Number,
    required: true,
    min: 0
  },
  bathrooms: {
    type: Number,
    required: true,
    min: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  // Lease terms provided by owner
  leaseTerms: {
    minimumDuration: { type: String, trim: true, default: '' },
    renewalTerms: { type: String, trim: true, default: '' }
  },
  // Property FAQs provided by owner
  faq: [{
    question: { type: String, trim: true, required: true },
    answer: { type: String, trim: true, required: true }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isVisible: {
    type: Boolean,
    default: true
  },
  analytics: {
    views: {
      type: Number,
      default: 0
    },
    enquiries: {
      type: Number,
      default: 0
    },
    bookings: {
      type: Number,
      default: 0
    },
    favorites: {
      type: Number,
      default: 0
    },
    applications: {
      type: Number,
      default: 0
    }
  },
  // Track unique viewers
  viewedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    viewedAt: {
      type: Date,
      default: Date.now
    },
    ipAddress: String
  }],
  tokenAmountReceived: {
    type: Number,
    default: 0
  }
});

// Update the updatedAt field before saving
propertySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for average rating
propertySchema.virtual('averageRating').get(function() {
  // This will be populated when we fetch properties with reviews
  return 0;
});

// Virtual for review count
propertySchema.virtual('reviewCount').get(function() {
  // This will be populated when we fetch properties with reviews
  return 0;
});

// Ensure virtual fields are serialized
propertySchema.set('toJSON', { virtuals: true });
propertySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Property', propertySchema); 