const CommunicationLog = require('../models/CommunicationLog');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendEmail } = require('../services/emailService');
const { sendWhatsApp } = require('../services/whatsappService');

// Unified communication log
exports.getCommunicationHistory = async (req, res) => {
  try {
    const { userId, type, startDate, endDate, limit = 50, page = 1 } = req.query;
    const query = {};
    
    // Build query based on parameters
    if (userId) query.user = userId;
    if (type) query.type = type;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { createdAt: -1 },
      populate: [
        { path: 'initiatedBy', select: 'name email' },
        { path: 'recipient', select: 'name email' }
      ]
    };

    const logs = await CommunicationLog.paginate(query, options);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch communication history', error: error.message });
  }
};

// Email communication
exports.sendEmail = async (req, res) => {
  try {
    const { to, subject, content, template, templateData, attachments } = req.body;
    
    const emailOptions = {
      to,
      subject,
      content: template ? undefined : content,
      template,
      templateData,
      attachments
    };

    const emailResponse = await sendEmail(emailOptions);
    
    // Log the email
    const log = await CommunicationLog.log({
      user: req.user.id,
      type: 'email',
      direction: 'outbound',
      subject,
      content: content || `Template: ${template}`,
      relatedTo: 'support',
      status: 'sent',
      initiatedBy: req.user.id,
      recipient: to,
      channelSpecificId: emailResponse.messageId,
      metadata: {
        template,
        templateData: templateData ? JSON.stringify(templateData) : undefined
      },
      attachments: attachments?.map(att => ({
        name: att.filename,
        type: att.contentType,
        size: att.size
      }))
    });

    res.json({
      success: true,
      message: 'Email sent successfully',
      logId: log._id,
      emailResponse
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send email', 
      error: error.message 
    });
  }
};

// WhatsApp communication
exports.sendWhatsApp = async (req, res) => {
  try {
    const { to, message, template, templateParams } = req.body;
    
    const whatsappResponse = await sendWhatsApp({
      to,
      message,
      template,
      templateParams
    });
    
    // Log the WhatsApp message
    const log = await CommunicationLog.log({
      user: req.user.id,
      type: 'whatsapp',
      direction: 'outbound',
      content: message || `Template: ${template}`,
      relatedTo: 'support',
      status: 'sent',
      initiatedBy: req.user.id,
      recipient: to,
      channelSpecificId: whatsappResponse.messageId,
      metadata: {
        template,
        templateParams: templateParams ? JSON.stringify(templateParams) : undefined
      }
    });

    res.json({
      success: true,
      message: 'WhatsApp message sent successfully',
      logId: log._id,
      whatsappResponse
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send WhatsApp message', 
      error: error.message 
    });
  }
};

// Communication status update
exports.updateCommunicationStatus = async (req, res) => {
  try {
    const { logId } = req.params;
    const { status, errorDetails } = req.body;

    const log = await CommunicationLog.findById(logId);
    if (!log) {
      return res.status(404).json({ message: 'Communication log not found' });
    }

    log.status = status;
    if (errorDetails) {
      log.error = errorDetails;
    }

    if (status === 'delivered' && !log.deliveredAt) {
      log.deliveredAt = new Date();
    } else if (status === 'read' && !log.readAt) {
      log.readAt = new Date();
    }

    await log.save();

    res.json({ success: true, message: 'Status updated successfully' });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update communication status', 
      error: error.message 
    });
  }
};

// Get communication statistics
exports.getCommunicationStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const match = {};

    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    const stats = await CommunicationLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            type: '$type',
            status: '$status',
            direction: '$direction'
          },
          count: { $sum: 1 },
          lastActivity: { $max: '$createdAt' }
        }
      },
      {
        $group: {
          _id: '$_id.type',
          statuses: {
            $push: {
              status: '$_id.status',
              direction: '$_id.direction',
              count: '$count',
              lastActivity: '$lastActivity'
            }
          },
          total: { $sum: '$count' }
        }
      },
      {
        $project: {
          _id: 0,
          type: '$_id',
          statuses: 1,
          total: 1
        }
      }
    ]);

    res.json(stats);
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to fetch communication statistics', 
      error: error.message 
    });
  }
};
