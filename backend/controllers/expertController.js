const Expert = require('../models/Expert');
const ExpertConsultation = require('../models/ExpertConsultation');
const User = require('../models/User');
const Notification = require('../models/Notification');
const CommunicationLog = require('../models/CommunicationLog');

// Expert profile management
exports.createOrUpdateExpertProfile = async (req, res) => {
  try {
    const expertData = {
      ...req.body,
      user: req.user.id,
      isVerified: req.user.role === 'admin' ? req.body.isVerified : false
    };

    const expert = await Expert.findOneAndUpdate(
      { user: req.user.id },
      expertData,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // If this is a new expert profile
    if (expert.isNew) {
      await User.findByIdAndUpdate(req.user.id, { role: 'expert' });
      await logExpertActivity(expert, 'profile_created', req.user.id);
    } else {
      await logExpertActivity(expert, 'profile_updated', req.user.id);
    }

    res.json(expert);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update expert profile', error: error.message });
  }
};

exports.getExpertProfile = async (req, res) => {
  try {
    const expert = await Expert.findOne({ user: req.params.userId || req.user.id })
      .populate('user', 'name email avatar')
      .populate('specializations');
    
    if (!expert) return res.status(404).json({ message: 'Expert profile not found' });
    res.json(expert);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch expert profile', error: error.message });
  }
};

// Consultation management
exports.bookConsultation = async (req, res) => {
  try {
    const { expertId, date, startTime, endTime, notes } = req.body;
    
    const expert = await Expert.findById(expertId);
    if (!expert) return res.status(404).json({ message: 'Expert not found' });

    // Check if slot is available
    const isAvailable = await checkExpertAvailability(expertId, date, startTime, endTime);
    if (!isAvailable) {
      return res.status(400).json({ message: 'Selected time slot is not available' });
    }

    const consultation = new ExpertConsultation({
      user: req.user.id,
      expert: expertId,
      date,
      startTime,
      endTime,
      notes,
      amount: expert.consultationFee,
      status: 'scheduled'
    });

    await consultation.save();
    await logConsultationActivity(consultation, 'booked', req.user.id);
    await notifyExpertAboutBooking(consultation);

    res.status(201).json(consultation);
  } catch (error) {
    res.status(500).json({ message: 'Failed to book consultation', error: error.message });
  }
};

exports.updateConsultationStatus = async (req, res) => {
  try {
    const { consultationId } = req.params;
    const { status, cancellationReason } = req.body;

    const consultation = await ExpertConsultation.findById(consultationId)
      .populate('user', 'name email')
      .populate('expert', 'user');

    if (!consultation) return res.status(404).json({ message: 'Consultation not found' });

    // Authorization check
    if (!canUpdateConsultation(consultation, req.user)) {
      return res.status(403).json({ message: 'Not authorized to update this consultation' });
    }

    const oldStatus = consultation.status;
    consultation.status = status;
    
    if (status === 'cancelled' && cancellationReason) {
      consultation.cancellationReason = cancellationReason;
      consultation.cancelledBy = req.user.id;
    }

    await consultation.save();
    await logConsultationActivity(consultation, `status_changed_to_${status}`, req.user.id);
    await notifyAboutConsultationUpdate(consultation, oldStatus);

    res.json(consultation);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update consultation', error: error.message });
  }
};

// Helper functions
async function checkExpertAvailability(expertId, date, startTime, endTime) {
  const existing = await ExpertConsultation.findOne({
    expert: expertId,
    date,
    $or: [
      { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
      { startTime: { $gte: startTime, $lt: endTime } }
    ],
    status: { $nin: ['cancelled', 'rejected'] }
  });
  return !existing;
}

function canUpdateConsultation(consultation, user) {
  if (user.role === 'admin') return true;
  if (user.id === consultation.user.toString()) return true;
  if (user.id === consultation.expert.user?.toString()) return true;
  return false;
}

async function logExpertActivity(expert, action, userId) {
  await CommunicationLog.log({
    user: userId,
    type: 'expert_profile',
    direction: 'outbound',
    subject: `Expert profile ${action.replace('_', ' ')}`,
    content: `Expert profile was ${action.replace('_', ' ')}`,
    relatedTo: 'expert',
    referenceId: expert._id,
    referenceModel: 'Expert',
    initiatedBy: userId
  });
}

async function logConsultationActivity(consultation, action, userId) {
  await CommunicationLog.log({
    user: userId,
    type: 'consultation',
    direction: 'outbound',
    subject: `Consultation ${action.replace(/_/g, ' ')}`,
    content: `Consultation was ${action.replace(/_/g, ' ')}`,
    relatedTo: 'consultation',
    referenceId: consultation._id,
    referenceModel: 'ExpertConsultation',
    initiatedBy: userId
  });
}

async function notifyExpertAboutBooking(consultation) {
  const expert = await Expert.findById(consultation.expert).populate('user', 'name');
  if (!expert) return;

  const notification = new Notification({
    user: expert.user._id,
    type: 'new_consultation',
    title: 'New Consultation Booked',
    message: `You have a new consultation booked on ${consultation.date}`,
    data: { consultationId: consultation._id },
    priority: 'high'
  });

  await notification.save();

  const io = require('../app').io;
  io.to(`user_${expert.user._id}`).emit('notification', {
    type: 'new_consultation',
    data: { consultationId: consultation._id }
  });
}

async function notifyAboutConsultationUpdate(consultation, oldStatus) {
  const notificationData = {
    type: 'consultation_updated',
    title: 'Consultation Updated',
    message: `Consultation status changed from ${oldStatus} to ${consultation.status}`,
    data: { consultationId: consultation._id },
    priority: 'medium'
  };

  // Notify both user and expert
  const notifications = [
    { user: consultation.user, ...notificationData },
    { user: consultation.expert.user, ...notificationData }
  ];

  await Notification.insertMany(notifications);

  const io = require('../app').io;
  notifications.forEach(notif => {
    io.to(`user_${notif.user}`).emit('notification', {
      type: 'consultation_updated',
      data: { consultationId: consultation._id }
    });
  });
}
