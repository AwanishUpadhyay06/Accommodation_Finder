const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  // Tenant who initiates the booking
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bookingType: {
    type: String,
    enum: ['visit', 'booking', 'application'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },
  visitDate: {
    type: Date,
    required: function() { return this.bookingType === 'visit'; }
  },
  visitTimeSlot: {
    type: String,
    required: function() { return this.bookingType === 'visit'; }
  },
  moveInDate: {
    type: Date,
    required: function() { return this.bookingType === 'booking'; }
  },
  moveOutDate: {
    type: Date,
    required: function() { return this.bookingType === 'booking'; }
  },
  totalAmount: {
    type: Number,
    required: function() { return this.bookingType === 'booking'; }
  },
  tokenAmount: {
    type: Number,
    default: 0
  },
  paymentId: { type: String },
  documents: [{
    name: String,
    url: String,
    type: {
      type: String,
      enum: ['id_proof', 'salary_slip', 'bank_statement', 'other']
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  notes: {
    type: String,
    trim: true
  }
}, { timestamps: true });

// Index for efficient queries
bookingSchema.index({ user: 1, property: 1 });
bookingSchema.index({ owner: 1, status: 1 });
bookingSchema.index({ status: 1, tokenStatus: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
