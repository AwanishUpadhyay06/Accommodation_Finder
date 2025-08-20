const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { auth } = require('../middleware/auth');

// GET /api/notifications - list current user's notifications
router.get('/', auth, async (req, res) => {
  try {
    const { unread, limit = 50, skip = 0 } = req.query;
    const query = { user: req.user._id };
    if (unread === 'true') query.read = false;

    const [items, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(parseInt(skip, 10))
        .limit(Math.min(parseInt(limit, 10) || 50, 100)),
      Notification.countDocuments(query)
    ]);

    res.json({ items, total });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/notifications/:id/read - mark one as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const n = await Notification.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { $set: { read: true } },
      { new: true }
    );
    if (!n) return res.status(404).json({ message: 'Notification not found' });
    res.json(n);
  } catch (err) {
    console.error('Error marking notification read:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/notifications/read-all - mark all as read
router.put('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true } });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Error marking all notifications read:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
