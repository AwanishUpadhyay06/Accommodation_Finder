const mongoose = require('mongoose');

const consultationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expert: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expert',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String, // Format: "HH:MM" in 24-hour format
    required: true
  },
  endTime: {
    type: String, // Format: "HH:MM" in 24-hour format
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'no-show'],
    default: 'scheduled'
  },
  meetingLink: {
    type: String,
    trim: true
  },
  meetingPlatform: {
    type: String,
    enum: ['zoom', 'google_meet', 'teams', 'other', null],
    default: null
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded', 'failed'],
    default: 'pending'
  },
  paymentId: {
    type: String
  },
  notes: {
    type: String,
    trim: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  review: {
    type: String,
    trim: true
  },
  cancellationReason: {
    type: String,
    trim: true
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rescheduledFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExpertConsultation'
  },
  isRescheduled: {
    type: Boolean,
    default: false
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  followUpSent: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
consultationSchema.index({ user: 1, status: 1 });
consultationSchema.index({ expert: 1, status: 1 });
consultationSchema.index({ date: 1, startTime: 1, expert: 1 }, { unique: true });

// Virtual for duration in minutes
consultationSchema.virtual('duration').get(function() {
  const start = new Date(`1970-01-01T${this.startTime}:00`);
  const end = new Date(`1970-01-01T${this.endTime}:00`);
  return (end - start) / (1000 * 60); // Convert ms to minutes
});

// Pre-save hook to validate time slots
consultationSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('startTime') || this.isModified('endTime') || this.isModified('date')) {
    const start = new Date(`1970-01-01T${this.startTime}:00`);
    const end = new Date(`1970-01-01T${this.endTime}:00`);
    
    if (start >= end) {
      return next(new Error('End time must be after start time'));
    }
    
    // Check if the slot is available for the expert
    const existing = await this.constructor.findOne({
      expert: this.expert,
      date: this.date,
      startTime: this.startTime,
      status: { $in: ['scheduled', 'confirmed'] },
      _id: { $ne: this._id }
    });
    
    if (existing) {
      return next(new Error('This time slot is already booked'));
    }
  }
  
  next();
});

module.exports = mongoose.model('ExpertConsultation', consultationSchema);
