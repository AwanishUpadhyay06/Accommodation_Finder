const FAQ = require('../models/FAQ');
const CommunicationLog = require('../models/CommunicationLog');

// Create a new FAQ
exports.createFAQ = async (req, res) => {
  try {
    const faq = new FAQ({
      ...req.body,
      createdBy: req.user.id,
      keywords: req.body.keywords || []
    });

    await faq.save();
    await logFAQActivity(faq, 'created', req.user.id);
    
    res.status(201).json(faq);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create FAQ', error: error.message });
  }
};

// Update an existing FAQ
exports.updateFAQ = async (req, res) => {
  try {
    const faq = await FAQ.findByIdAndUpdate(
      req.params.id,
      { 
        ...req.body,
        lastUpdated: Date.now(),
        $inc: { __v: 1 } // Increment version
      },
      { new: true, runValidators: true }
    );

    if (!faq) {
      return res.status(404).json({ message: 'FAQ not found' });
    }

    await logFAQActivity(faq, 'updated', req.user.id);
    res.json(faq);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update FAQ', error: error.message });
  }
};

// Delete an FAQ
exports.deleteFAQ = async (req, res) => {
  try {
    const faq = await FAQ.findByIdAndDelete(req.params.id);
    
    if (!faq) {
      return res.status(404).json({ message: 'FAQ not found' });
    }

    await logFAQActivity(faq, 'deleted', req.user.id);
    res.json({ message: 'FAQ deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete FAQ', error: error.message });
  }
};

// Get FAQs with filters and search
exports.getFAQs = async (req, res) => {
  try {
    const { category, search, limit = 10, page = 1 } = req.query;
    const query = { isActive: true };
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: { category: 1, question: 1 }
    };

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$text = { $search: search };
      options.select = {
        score: { $meta: 'textScore' }
      };
      options.sort = {
        score: { $meta: 'textScore' },
        ...options.sort
      };
    }

    const faqs = await FAQ.paginate(query, options);
    
    // Increment view count for searched items
    if (search && faqs.docs.length > 0) {
      const ids = faqs.docs.map(doc => doc._id);
      await FAQ.updateMany(
        { _id: { $in: ids } },
        { $inc: { views: 1 } }
      );
    }

    res.json(faqs);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch FAQs', error: error.message });
  }
};

// Get FAQ by ID
exports.getFAQById = async (req, res) => {
  try {
    const faq = await FAQ.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    );

    if (!faq) {
      return res.status(404).json({ message: 'FAQ not found' });
    }

    res.json(faq);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch FAQ', error: error.message });
  }
};

// Rate FAQ helpfulness
exports.rateFAQ = async (req, res) => {
  try {
    const { id } = req.params;
    const { isHelpful } = req.body;
    const updateField = isHelpful ? 'helpfulCount' : 'notHelpfulCount';

    const faq = await FAQ.findByIdAndUpdate(
      id,
      { $inc: { [updateField]: 1 } },
      { new: true }
    );

    if (!faq) {
      return res.status(404).json({ message: 'FAQ not found' });
    }

    res.json({ 
      message: 'Thank you for your feedback!',
      helpfulCount: faq.helpfulCount,
      notHelpfulCount: faq.notHelpfulCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update FAQ rating', error: error.message });
  }
};

// Get FAQ categories
exports.getCategories = async (req, res) => {
  try {
    const categories = await FAQ.distinct('category');
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch categories', error: error.message });
  }
};

// Helper function to log FAQ activities
async function logFAQActivity(faq, action, userId) {
  await CommunicationLog.log({
    user: userId,
    type: 'faq',
    direction: 'outbound',
    subject: `FAQ ${action}: ${faq.question.substring(0, 50)}...`,
    content: `FAQ was ${action}`,
    relatedTo: 'knowledge_base',
    referenceId: faq._id,
    referenceModel: 'FAQ',
    initiatedBy: userId,
    metadata: {
      category: faq.category,
      action
    }
  });
}
