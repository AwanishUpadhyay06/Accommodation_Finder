const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true
  },
  answer: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['booking', 'payment', 'account', 'technical', 'cancellation', 'other']
  },
  subcategory: {
    type: String,
    trim: true
  },
  keywords: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  views: {
    type: Number,
    default: 0
  },
  helpfulCount: {
    type: Number,
    default: 0
  },
  notHelpfulCount: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for search functionality
faqSchema.index({ question: 'text', answer: 'text', keywords: 1 });
faqSchema.index({ category: 1, isActive: 1 });

// Text index for search
faqSchema.index(
  { 
    question: 'text', 
    answer: 'text',
    keywords: 'text'
  },
  {
    weights: {
      question: 10,
      keywords: 5,
      answer: 1
    },
    name: 'faq_search_idx'
  }
);

// Pre-save hook to update lastUpdated
faqSchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  next();
});

module.exports = mongoose.model('FAQ', faqSchema);
