import mongoose, { Schema, Document } from "mongoose";

export interface ISalvageReport extends Document {
  user: mongoose.Schema.Types.ObjectId;
  report_date: Date;
  file_number: string;
  date_received: Date;
  claim_number: string;
  policy_number: string;
  date_of_loss: Date;
  reported_loss_type: string;
  appraiser_name: string;
  appraiser_phone: string;
  appraiser_email: string;
  item_type: string;
  year: string;
  make: string;
  item_model: string;
  vin: string;
  adjuster_name: string;
  insured_name: string;
  company_name: string;
  company_address: string;
  cause_of_loss_summary: string;
  appraiser_comments: string;
  next_report_due: Date;
  imageUrls: string[];
  aiExtractedDetails: Record<string, any>;
  comparableItems: {
    title: string;
    link: string;
    price: string;
    snippet: string;
    location: string;
    image_url: string;
  }[];
  valuation: Record<string, any>;
}

const SalvageReportSchema: Schema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    report_date: { type: Date, required: true },
    file_number: { type: String, required: true },
    date_received: { type: Date, required: true },
    claim_number: { type: String, required: true },
    policy_number: { type: String, required: true },
    date_of_loss: { type: Date, required: false },
    reported_loss_type: { type: String, required: false },
    appraiser_name: { type: String, required: true },
    appraiser_phone: { type: String, required: true },
    appraiser_email: { type: String, required: true },
    item_type: { type: String, required: false },
    year: { type: String, required: false },
    make: { type: String, required: false },
    item_model: { type: String, required: false },
    vin: { type: String, required: false },
    adjuster_name: { type: String, required: true },
    insured_name: { type: String, required: true },
    company_name: { type: String, required: true },
    company_address: { type: String, required: true },
    cause_of_loss_summary: { type: String, required: false },
    appraiser_comments: { type: String, required: true },
    next_report_due: { type: Date, required: true },
    imageUrls: [{ type: String }],
    aiExtractedDetails: { type: Schema.Types.Mixed },
    comparableItems: [
      {
        title: { type: String },
        link: { type: String },
        price: { type: String },
        snippet: { type: String },
        location: { type: String },
        image_url: { type: String },
      },
    ],
    valuation: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

const SalvageReport = mongoose.model<ISalvageReport>(
  "SalvageReport",
  SalvageReportSchema
);

export default SalvageReport;
