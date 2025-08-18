import mongoose, { Schema, Document } from "mongoose";

export type AssetGroupingMode = "single_lot" | "per_item" | "per_photo";

export interface IAssetLot {
  lot_id: string;
  title: string;
  description: string;
  condition?: string;
  estimated_value?: string;
  tags?: string[];
  serial_no_or_label?: string | null;
  details?: string;
  image_url?: string | null;
  image_indexes: number[]; // 0-based indexes of images that belong to this lot
  image_urls?: string[]; // resolved URLs for the images in this lot
}

export interface IAssetReport extends Document {
  user: mongoose.Schema.Types.ObjectId;
  grouping_mode: AssetGroupingMode;
  imageUrls: string[];
  lots: IAssetLot[];
  analysis?: Record<string, any>; // raw AI output for reference
  // Added metadata fields
  client_name?: string;
  effective_date?: Date;
  appraisal_purpose?: string;
  owner_name?: string;
  appraiser?: string;
  appraisal_company?: string;
  industry?: string;
  inspection_date?: Date;
}

const AssetLotSchema: Schema<IAssetLot> = new Schema(
  {
    lot_id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    condition: { type: String },
    estimated_value: { type: String },
    tags: [{ type: String }],
    serial_no_or_label: { type: String },
    details: { type: String },
    image_url: { type: String },
    image_indexes: [{ type: Number, required: true }],
    image_urls: [{ type: String }],
  },
  { _id: false }
);

const AssetReportSchema: Schema<IAssetReport> = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    grouping_mode: {
      type: String,
      enum: ["single_lot", "per_item", "per_photo"],
      required: true,
    },
    imageUrls: [{ type: String, required: true }],
    lots: { type: [AssetLotSchema], default: [] },
    // New optional report-level fields
    client_name: { type: String },
    effective_date: { type: Date },
    appraisal_purpose: { type: String },
    owner_name: { type: String },
    appraiser: { type: String },
    appraisal_company: { type: String },
    industry: { type: String },
    inspection_date: { type: Date },
    analysis: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

const AssetReport = mongoose.model<IAssetReport>(
  "AssetReport",
  AssetReportSchema
);
export default AssetReport;
