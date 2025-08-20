const Chat = require('../models/Chat');
const User = require('../models/User');
const CommunicationLog = require('../models/CommunicationLog');
const { publishToQueue } = require('../services/queueService');
const { sendNotification } = require('../services/notificationService');

// Initialize or get user's chat
const getOrCreateChat = async (req, res) => {
  try {
    const { userId } = req.params;
    const supportAgentId = req.user.isSupportAgent ? req.user.id : null;

    let chat = await Chat.findOne({
      user: userId,
      status: { $ne: 'closed' }
    });

    if (!chat) {
      chat = new Chat({
        user: userId,
        supportAgent: supportAgentId,
        messages: []
      });
      await chat.save();

      // Log the chat creation
      await CommunicationLog.log({
        user: userId,
        type: 'chat',
        direction: 'inbound',
        content: 'Chat session started',
        relatedTo: 'support',
        referenceId: chat._id,
        referenceModel: 'Chat',
        status: 'delivered',
        initiatedBy: userId,
        recipient: supportAgentId || null
      });

      // Notify support team if no agent assigned
      if (!supportAgentId) {
        await notifySupportTeam(chat._id, userId);
      }
    }

    res.json(chat);
  } catch (error) {
    console.error('Error in getOrCreateChat:', error);
    res.status(500).json({ message: 'Failed to initialize chat', error: error.message });
  }
};

// Send a message in chat
const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content, isBot = false } = req.body;
    const senderId = isBot ? null : req.user.id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Check if user is part of this chat
    if (!chat.user.equals(senderId) && !chat.supportAgent?.equals(senderId) && !isBot) {
      return res.status(403).json({ message: 'Not authorized to send message in this chat' });
    }

    const message = {
      sender: senderId,
      content,
      isBot,
      timestamp: new Date()
    };

    chat.messages.push(message);
    chat.updatedAt = new Date();
    
    // If this is the first message from support, update the agent
    if (req.user.isSupportAgent && !chat.supportAgent) {
      chat.supportAgent = senderId;
    }

    await chat.save();

    // Publish message to WebSocket
    const io = req.app.get('io');
    io.to(`chat_${chatId}`).emit('new_message', {
      chatId,
      message: {
        ...message.toObject ? message.toObject() : message,
        sender: message.sender ? await User.findById(message.sender, 'name avatar') : null
      }
    });

    // Log the message
    await CommunicationLog.log({
      user: isBot ? chat.user : senderId,
      type: 'chat',
      direction: isBot ? 'outbound' : 'inbound',
      content,
      relatedTo: 'support',
      referenceId: chat._id,
      referenceModel: 'Chat',
      status: 'delivered',
      initiatedBy: isBot ? null : senderId,
      recipient: isBot ? chat.user : (chat.supportAgent || null),
      metadata: {
        isBot,
        chatId: chat._id.toString()
      }
    });

    // If this is a user message and no agent is assigned, notify support team
    if (!isBot && !chat.supportAgent) {
      await notifySupportTeam(chat._id, chat.user);
    }

    // If this is a bot message, queue for processing
    if (isBot) {
      await processBotMessage(chat, message);
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Error in sendMessage:', error);
    res.status(500).json({ message: 'Failed to send message', error: error.message });
  }
};

// Get chat history
const getChatHistory = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const chat = await Chat.findOne({
      _id: chatId,
      $or: [
        { user: userId },
        { supportAgent: userId },
        { supportAgent: { $exists: false } }
      ]
    }).populate('user', 'name email avatar')
      .populate('supportAgent', 'name email avatar');

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found or access denied' });
    }

    res.json(chat);
  } catch (error) {
    console.error('Error in getChatHistory:', error);
    res.status(500).json({ message: 'Failed to fetch chat history', error: error.message });
  }
};

// Get user's active chats (for support agents)
const getUserChats = async (req, res) => {
  try {
    const { status = 'active' } = req.query;
    const userId = req.user.id;

    const query = {};
    
    if (req.user.isSupportAgent) {
      query.$or = [
        { supportAgent: userId },
        { supportAgent: { $exists: false } }
      ];
    } else {
      query.user = userId;
    }

    if (status === 'active') {
      query.status = 'active';
    } else if (status === 'closed') {
      query.status = 'closed';
    }

    const chats = await Chat.find(query)
      .populate('user', 'name email avatar')
      .populate('supportAgent', 'name email avatar')
      .sort({ updatedAt: -1 });

    res.json(chats);
  } catch (error) {
    console.error('Error in getUserChats:', error);
    res.status(500).json({ message: 'Failed to fetch chats', error: error.message });
  }
};

// Close a chat
const closeChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const chat = await Chat.findOne({
      _id: chatId,
      $or: [
        { user: userId },
        { supportAgent: userId },
        { supportAgent: { $exists: false } }
      ]
    });

    if (!chat) {
      return res.status(404).json({ message: 'Chat not found or access denied' });
    }

    chat.status = 'closed';
    chat.updatedAt = new Date();
    await chat.save();

    // Log the chat closure
    await CommunicationLog.log({
      user: userId,
      type: 'chat',
      direction: 'outbound',
      content: 'Chat session closed',
      relatedTo: 'support',
      referenceId: chat._id,
      referenceModel: 'Chat',
      status: 'delivered',
      initiatedBy: userId,
      recipient: chat.user.equals(userId) ? (chat.supportAgent || null) : chat.user
    });

    // Notify other participants
    const io = req.app.get('io');
    io.to(`chat_${chatId}`).emit('chat_closed', { chatId });

    res.json({ message: 'Chat closed successfully' });
  } catch (error) {
    console.error('Error in closeChat:', error);
    res.status(500).json({ message: 'Failed to close chat', error: error.message });
  }
};

// Helper function to process bot messages
async function processBotMessage(chat, message) {
  try {
    // Simple FAQ matching
    const faqMatch = await matchFAQ(message.content);
    if (faqMatch) {
      // Add a small delay to simulate typing
      setTimeout(async () => {
        await sendMessage({
          params: { chatId: chat._id },
          body: { content: faqMatch.answer, isBot: true },
          user: { id: null, isSupportAgent: false },
          app: { get: () => ({ io: require('../app').io }) }
        }, { json: () => {} });
      }, 1000);
    }
  } catch (error) {
    console.error('Error in processBotMessage:', error);
  }
}

// Helper function to match FAQ
async function matchFAQ(question) {
  // Simple implementation - in production, use NLP or better matching
  const faq = await FAQ.findOne({
    $text: { $search: question },
    isActive: true
  }).sort({ score: { $meta: 'textScore' } });

  return faq;
}

// Helper function to notify support team
async function notifySupportTeam(chatId, userId) {
  try {
    // Find available support agents
    const supportAgents = await User.find({
      role: 'support',
      isAvailable: true
    }).limit(5); // Notify up to 5 available agents

    // Create notifications
    const notifications = supportAgents.map(agent => ({
      user: agent._id,
      type: 'new_chat',
      title: 'New Chat Request',
      message: 'A user is waiting for support',
      data: { chatId, userId },
      priority: 'high'
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
      
      // Emit real-time notifications
      const io = require('../app').io;
      supportAgents.forEach(agent => {
        io.to(`user_${agent._id}`).emit('notification', {
          type: 'new_chat',
          data: { chatId, userId }
        });
      });
    }

    // Also queue for email/SMS if no one responds
    await publishToQueue('pending_support', {
      chatId,
      userId,
      timestamp: new Date()
    }, { delay: 300000 }); // 5 minutes delay
  } catch (error) {
    console.error('Error notifying support team:', error);
  }
}

module.exports = {
  getOrCreateChat,
  sendMessage,
  getChatHistory,
  getUserChats,
  closeChat
};
