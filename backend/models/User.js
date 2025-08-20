const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['tenant', 'owner'],
    required: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  profilePicture: {
    type: String
  },
  // Tenant-specific fields
  dateOfBirth: {
    type: Date
  },
  occupation: {
    type: String,
    trim: true
  },
  documents: [{
    filename: String,
    originalName: String,
    path: String,
    type: {
      type: String,
      enum: ['id_proof', 'income_proof', 'employment_letter', 'bank_statement', 'other']
    },
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  // Owner-specific fields
  businessName: {
    type: String,
    trim: true
  },
  businessLicense: {
    type: String,
    trim: true
  },
  rentalAgreements: [{
    filename: String,
    originalName: String,
    path: String,
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property'
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    type: {
      type: String,
      enum: ['template', 'signed', 'draft']
    },
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  // Notification preferences
  notificationPreferences: {
    email: {
      type: Boolean,
      default: true
    },
    sms: {
      type: Boolean,
      default: false
    },
    push: {
      type: Boolean,
      default: true
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Static method to find user by email or username for login
userSchema.statics.findByEmailOrUsername = async function(identifier) {
  // First try to find by email, then by username
  let user = await this.findOne({ email: identifier });
  if (!user) {
    user = await this.findOne({ username: identifier });
  }
  return user;
};

// Method to generate system username
userSchema.statics.generateUsername = function(name) {
  const baseName = name.toLowerCase().replace(/\s+/g, '');
  const timestamp = Date.now().toString().slice(-6);
  return `${baseName}${timestamp}`;
};

// Method to generate system password
userSchema.statics.generatePassword = function() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

module.exports = mongoose.model('User', userSchema); 