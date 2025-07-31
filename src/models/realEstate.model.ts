import mongoose, { Schema } from "mongoose";

// Sub-schema for a single comparable property's details
const ComparablePropertyDetailSchema = new Schema(
  {
    "Address / Location": { type: String },
    "List Price": { type: String },
    "Square Footage": { type: String },
    "Square Footage Adjustment": { type: String },
    "Lot Size": { type: String },
    "Lot Size Adjustment": { type: String },
    Bedrooms: { type: String },
    "Bedroom Adjustment": { type: String },
    Bathrooms: { type: String },
    "Bathroom Adjustment": { type: String },
    Garage: { type: String },
    "Garage Adjustment": { type: String },
    Basement: { type: String },
    "Basement Adjustment": { type: String },
    "Other Features": { type: String },
    "Other Features Adjustment": { type: String },
    Condition: { type: String },
    "Condition Adjustment": { type: String },
    Adjustments: { type: String },
    "Adjusted Value": { type: String },
  },
  { _id: false }
);

// Sub-schema for valuation
const ValuationSchema = new Schema(
  {
    fair_market_value: { type: String },
    value_source: { type: String },
    adjusted_value_from_comparable: { type: String },
    comparable_used: { type: String },
    final_adjusted_value: { type: String },
    final_estimate_summary: { type: String },
    final_estimate_value: { type: String },
    details: { type: String },
  },
  { _id: false }
);

const RealEstateReportSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    property_details: {
      property_type: { type: String },
      address: { type: String },
      renderItem: { type: String },
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
    comparableProperties: {
      type: Map,
      of: ComparablePropertyDetailSchema,
    },
    valuation: ValuationSchema,
  },
  { timestamps: true }
);

const RealEstateReport = mongoose.model(
  "RealEstateReport",
  RealEstateReportSchema
);

export default RealEstateReport;
