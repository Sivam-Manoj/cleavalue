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
    language: { type: String, enum: ["en", "fr", "es"], default: "en" },
    property_details: {
      owner_name: { type: String },
      alternate_owner_name: { type: String },
      address: { type: String },
      land_description: { type: String },
      municipality: { type: String },
      title_number: { type: String },
      parcel_number: { type: String },
      land_area_hectares: { type: String },
      land_area_acres: { type: String },
      source_quarter_section: { type: String },
      ownership_share: { type: String },
      assessed_value_city: { type: String },
      property_type: { type: String }, // Kept from original
      description: { type: String }, // Kept from original
    },
    report_dates: {
      report_date: { type: Date },
      effective_date: { type: Date },
      inspection_date: { type: Date },
    },
    house_details: {
      year_built: { type: String },
      lottery_home: { type: Boolean },
      square_footage: { type: String },
      lot_size_sqft: { type: String },
      number_of_rooms: { type: String },
      number_of_full_bathrooms: { type: String },
      number_of_half_bathrooms: { type: String },
      garage_description: { type: String },
      basement_description: { type: String },
      major_features: [{ type: String }],
      known_issues: [{ type: String }],
    },
    inspector_info: {
      inspector_name: { type: String },
      company_name: { type: String },
      contact_email: { type: String },
      contact_phone: { type: String },
      credentials: { type: String },
    },
    imageUrls: [{ type: String }],
    comparableProperties: {
      type: Map,
      of: ComparablePropertyDetailSchema,
    },
    valuation: ValuationSchema,
    marketTrend: {
      type: [
        {
          marketTrends2025: {
            reginaBenchmarkPrice: {
              march: Number,
              june: Number,
              yearOverYearIncreasePercent: Number,
            },
            inventory: {
              monthsOfSupply: Number,
              historicalAverageMonths: Number,
            },
            salesActivity: {
              comparisonTo10YearAverage: String,
            },
            forecast: {
              lowEstimatePriceGrowthPercent: Number,
              highEstimatePriceGrowthPercent: Number,
              expectedLate2025AveragePriceCAD: Number,
            },
          },
          buyerSellerInsights: {
            marketType: String,
            recommendation: {
              seller: String,
              buyer: String,
            },
          },
          summary: {
            reginaMarket: String,
            lakeridgeMarket: String,
            overallOutlook: String,
          },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

const RealEstateReport = mongoose.model(
  "RealEstateReport",
  RealEstateReportSchema
);

export default RealEstateReport;
