import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: function(this: any) { return this.authProvider === 'email'; },
    sparse: true, // Allows multiple documents to have a null value for a unique field
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: function(this: any) { return this.authProvider === 'email'; },
    minlength: 6,
    select: false,
  },
  companyName: {
    type: String,
  },
  contactEmail: {
    type: String,
  },
  contactPhone: {
    type: String,
  },
  companyAddress: {
    type: String,
  },
  authProvider: {
    type: String,
    required: true,
    enum: ['email'],
    default: 'email',
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationCode: {
    type: String,
  },
  verificationCodeExpires: {
    type: Date,
  },
  // Legacy single refresh token (kept for backward-compatible migration only)
  refreshToken: {
    type: String,
    select: false,
  },
  refreshTokens: [
    {
      tokenHash: { type: String, required: true },
      expiresAt: { type: Date, required: true },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  passwordResetToken: {
    type: String,
  },
  passwordResetExpires: {
    type: Date,
  },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

export default User;
