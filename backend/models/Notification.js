const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { // recipient
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  actor: { // who triggered it
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['enquiry_created', 'enquiry_replied', 'visit_requested', 'visit_responded', 'general'],
    default: 'general',
    index: true
  },
  title: { type: String },
  message: { type: String },
  entity: {
    id: { type: mongoose.Schema.Types.ObjectId },
    model: { type: String },
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  },
  read: { type: Boolean, default: false, index: true },
  meta: { type: Object }
}, {
  timestamps: true
});

notificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
