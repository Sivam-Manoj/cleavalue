import mongoose from 'mongoose';

const savedInputSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  formData: {
    // Report metadata fields
    clientName: String,
    effectiveDate: String,
    appraisalPurpose: String,
    ownerName: String,
    appraiser: String,
    appraisalCompany: String,
    industry: String,
    inspectionDate: String,
    contractNo: String,
    language: {
      type: String,
      enum: ['en', 'fr', 'es'],
      default: 'en',
    },
    currency: String,
    
    // Valuation options
    includeValuationTable: Boolean,
    selectedValuationMethods: [String],
    
    // Grouping mode
    groupingMode: {
      type: String,
      enum: ['single_lot', 'per_item', 'per_photo', 'catalogue', 'combined', 'mixed'],
    },
    combinedModes: [String],
  },
}, { timestamps: true });

// Index for faster queries
savedInputSchema.index({ user: 1, createdAt: -1 });

const SavedInput = mongoose.model('SavedInput', savedInputSchema);

export default SavedInput;
