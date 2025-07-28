import mongoose, { Schema, Document } from 'mongoose';

// Sub-schema for comparable properties
const ComparablePropertySchema = new Schema({
  title: { type: String },
  link: { type: String },
  price: { type: String },
  address: { type: String },
  size: { type: String },
  snippet: { type: String },
}, { _id: false });

// Sub-schema for valuation
const ValuationSchema = new Schema({
  fair_market_value: { type: String },
  value_source: { type: String },
  adjusted_value_from_comparable: { type: String },
  comparable_used: { type: String },
}, { _id: false });

const RealEstateReportSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  property_details: {
    property_type: { type: String },
    address: { type: String },
    municipality: { type: String },
    description: { type: String },
  },
  report_dates: {
    report_date: { type: Date },
    effective_date: { type: Date },
    inspection_date: { type: Date },
  },
  house_details: {
    square_footage: { type: String },
    bedrooms: { type: Number },
    bathrooms_full: { type: Number },
    bathrooms_half: { type: Number },
    garage: { type: String },
    basement: { type: String },
    features: [{ type: String }],
    issues: [{ type: String }],
  },
  inspector_info: {
    inspector_name: { type: String },
    inspection_company: { type: String },
    inspector_license: { type: String },
  },
  imageUrls: [{ type: String }],
  comparableProperties: [ComparablePropertySchema],
  valuation: ValuationSchema,
}, { timestamps: true });

const RealEstateReport = mongoose.model('RealEstateReport', RealEstateReportSchema);

export default RealEstateReport;
