const mongoose = require('mongoose');

const communicationLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['chat', 'ticket', 'email', 'whatsapp', 'call', 'notification']
  },
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    required: true
  },
  subject: {
    type: String,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  relatedTo: {
    type: String,
    enum: ['booking', 'property', 'payment', 'account', 'general', 'support'],
    required: true
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'referenceModel'
  },
  referenceModel: {
    type: String,
    enum: ['Chat', 'Ticket', 'ExpertConsultation', 'Booking', 'User']
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'failed', 'pending'],
    default: 'sent'
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  channelSpecificId: {
    type: String,
    index: true
  },
  attachments: [{
    url: String,
    name: String,
    type: String,
    size: Number
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  error: {
    code: String,
    message: String,
    details: mongoose.Schema.Types.Mixed
  },
  readAt: Date,
  deliveredAt: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
communicationLogSchema.index({ createdAt: -1 });
communicationLogSchema.index({ user: 1, type: 1, createdAt: -1 });
communicationLogSchema.index({ 'metadata.conversationId': 1 });

// Text index for search
communicationLogSchema.index(
  { content: 'text', subject: 'text', 'metadata.subject': 'text' },
  {
    weights: {
      subject: 10,
      'metadata.subject': 8,
      content: 5
    },
    name: 'communication_search_idx'
  }
);

// Virtual for message status
communicationLogSchema.virtual('isRead').get(function() {
  return this.status === 'read';
});

// Pre-save hook to update timestamps based on status
communicationLogSchema.pre('save', function(next) {
  const now = new Date();
  
  if (this.isModified('status')) {
    if (this.status === 'read' && !this.readAt) {
      this.readAt = now;
    } else if (this.status === 'delivered' && !this.deliveredAt) {
      this.deliveredAt = now;
    }
  }
  
  next();
});

// Static method to log communication
communicationLogSchema.statics.log = async function(logData) {
  try {
    const log = new this(logData);
    await log.save();
    return log;
  } catch (error) {
    console.error('Error logging communication:', error);
    throw error;
  }
};

// Method to mark as read
communicationLogSchema.methods.markAsRead = async function() {
  if (this.status !== 'read') {
    this.status = 'read';
    this.readAt = new Date();
    await this.save();
  }
  return this;
};

module.exports = mongoose.model('CommunicationLog', communicationLogSchema);
