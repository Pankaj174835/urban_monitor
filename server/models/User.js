const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { createDualModel } = require('./modelFactory');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6
  },
  role: {
    type: String,
    enum: ['citizen', 'admin'],
    default: 'citizen'
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  alertPreferences: {
    enabled: { type: Boolean, default: true },
    radiusMeters: { type: Number, default: 2500 },
    preferredLocation: {
      latitude: { type: Number, default: 19.4630 },
      longitude: { type: Number, default: 72.8020 },
      address: { type: String, default: 'Virar West, Palghar' }
    }
  }
}, {
  timestamps: true
});

// Pre-save password hashing for Mongoose
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  // If password is already a valid bcrypt hash, do not re-hash
  const isAlreadyHashed = typeof this.password === 'string' &&
    (this.password.startsWith('$2a$') || this.password.startsWith('$2b$') || this.password.startsWith('$2y$')) &&
    this.password.length === 60;

  if (isAlreadyHashed) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject ? this.toObject() : { ...this };
  delete obj.password;
  return obj;
};

const User = createDualModel('User', userSchema);

module.exports = User;
