import mongoose, { Schema, Document } from "mongoose";

export type AssetGroupingMode =
  | "single_lot"
  | "per_item"
  | "per_photo"
  | "catalogue"
  | "combined"
  | "mixed";

export interface ICatalogueItem {
  title: string;
  sn_vin?: string; // "not found" when missing
  description?: string;
  condition?: string;
  details?: string;
  estimated_value?: string; // CA$...
  // Excel-related optional fields (persist AI outputs for XLSX)
  categories?: string;
  lot_number?: string | number;
  quantity?: number;
  must_take?: boolean;
  show_on_website?: boolean;
  close_date?: string;
  bid_increment?: number;
  location?: string;
  opening_bid?: number;
  latitude?: number;
  longitude?: number;
  item_condition?: string;
  serial_number?: string;
  // Optional per-item image reference (global index resolved by job)
  image_local_index?: number; // preferred local best image index within this lot's image set
  image_index?: number; // 0-based index into report-level imageUrls
  image_url?: string; // resolved URL for convenience in templates
}

export interface IAssetLot {
  lot_id: string;
  title: string;
  description: string;
  condition?: string;
  estimated_value?: string;
  tags?: string[];
  // Excel-related fields (persist AI outputs for XLSX)
  lot_number?: string | number;
  quantity?: number;
  must_take?: boolean;
  categories?: string;
  serial_number?: string;
  show_on_website?: boolean;
  close_date?: string;
  bid_increment?: number;
  location?: string;
  opening_bid?: number;
  latitude?: number;
  longitude?: number;
  item_condition?: string;
  serial_no_or_label?: string | null;
  details?: string;
  image_url?: string | null;
  image_indexes: number[]; // 0-based indexes of images that belong to this lot
  image_urls?: string[]; // resolved URLs for the images in this lot
  items?: ICatalogueItem[]; // catalogue-specific nested items
  // Mixed mode metadata (optional)
  mixed_group_index?: number;
  sub_mode?: 'single_lot' | 'per_item' | 'per_photo';
}

export type ReportStatus = 'draft' | 'preview' | 'pending_approval' | 'approved' | 'declined';

export interface IAssetReport extends Document {
  user: mongoose.Schema.Types.ObjectId;
  grouping_mode: AssetGroupingMode;
  imageUrls: string[];
  lots: IAssetLot[];
  analysis?: Record<string, any>; // raw AI output for reference
  // Workflow status
  status: ReportStatus;
  preview_data?: Record<string, any>; // Editable data shown in preview modal
  preview_files?: {
    docx?: string;
    excel?: string;
    images?: string;
  }; // Preview file URLs for admin review
  preview_submitted_at?: Date;
  approval_requested_at?: Date;
  approval_processed_at?: Date;
  decline_reason?: string;
  // Added metadata fields
  client_name?: string;
  effective_date?: Date;
  appraisal_purpose?: string;
  owner_name?: string;
  appraiser?: string;
  appraisal_company?: string;
  industry?: string;
  inspection_date?: Date;
  contract_no?: string;
  language?: 'en' | 'fr' | 'es';
  currency?: string; // ISO currency code, e.g., CAD, USD, INR
  // Valuation comparison table
  include_valuation_table?: boolean;
  valuation_methods?: Array<'FML' | 'TKV' | 'OLV' | 'FLV'>;
  valuation_data?: {
    baseFMV: number;
    methods: Array<{
      method: string;
      fullName: string;
      description: string;
      percentage: number;
      value: number;
      saleConditions: string;
      timeline: string;
      useCase: string;
    }>;
  };
}

const CatalogueItemSchema: Schema<ICatalogueItem> = new Schema(
  {
    title: { type: String, required: true },
    sn_vin: { type: String },
    description: { type: String },
    condition: { type: String },
    details: { type: String },
    estimated_value: { type: String },
    // Excel-related optional fields
    categories: { type: String },
    lot_number: { type: Schema.Types.Mixed },
    quantity: { type: Number },
    must_take: { type: Boolean },
    show_on_website: { type: Boolean },
    close_date: { type: String },
    bid_increment: { type: Number },
    location: { type: String },
    opening_bid: { type: Number },
    latitude: { type: Number },
    longitude: { type: Number },
    item_condition: { type: String },
    serial_number: { type: String },
    image_local_index: { type: Number },
    image_index: { type: Number },
    image_url: { type: String },
  },
  { _id: false }
);

const AssetLotSchema: Schema<IAssetLot> = new Schema(
  {
    lot_id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    condition: { type: String },
    estimated_value: { type: String },
    tags: [{ type: String }],
    // Excel-related optional fields
    lot_number: { type: Schema.Types.Mixed },
    quantity: { type: Number },
    must_take: { type: Boolean },
    categories: { type: String },
    serial_number: { type: String },
    show_on_website: { type: Boolean },
    close_date: { type: String },
    bid_increment: { type: Number },
    location: { type: String },
    opening_bid: { type: Number },
    latitude: { type: Number },
    longitude: { type: Number },
    item_condition: { type: String },
    serial_no_or_label: { type: String },
    details: { type: String },
    image_url: { type: String },
    image_indexes: [{ type: Number, required: true }],
    image_urls: [{ type: String }],
    items: { type: [CatalogueItemSchema], default: undefined },
    mixed_group_index: { type: Number },
    sub_mode: { type: String, enum: ['single_lot', 'per_item', 'per_photo'] },
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
      enum: [
        "single_lot",
        "per_item",
        "per_photo",
        "catalogue",
        "combined",
        "mixed",
      ],
      required: true,
    },
    imageUrls: [{ type: String, required: true }],
    lots: { type: [AssetLotSchema], default: [] },
    // Workflow status fields
    status: {
      type: String,
      enum: ['draft', 'preview', 'pending_approval', 'approved', 'declined'],
      default: 'draft',
      required: true,
    },
    preview_data: { type: Schema.Types.Mixed },
    preview_files: {
      docx: { type: String },
      excel: { type: String },
      images: { type: String },
    },
    preview_submitted_at: { type: Date },
    approval_requested_at: { type: Date },
    approval_processed_at: { type: Date },
    decline_reason: { type: String },
    // New optional report-level fields
    client_name: { type: String },
    effective_date: { type: Date },
    appraisal_purpose: { type: String },
    owner_name: { type: String },
    appraiser: { type: String },
    appraisal_company: { type: String },
    industry: { type: String },
    inspection_date: { type: Date },
    contract_no: { type: String },
    language: { type: String, enum: ['en', 'fr', 'es'], default: 'en' },
    currency: { type: String, default: 'CAD' },
    include_valuation_table: { type: Boolean, default: false },
    valuation_methods: [{ type: String, enum: ['FML', 'TKV', 'OLV', 'FLV'] }],
    valuation_data: { type: Schema.Types.Mixed },
    analysis: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

const AssetReport = mongoose.model<IAssetReport>(
  "AssetReport",
  AssetReportSchema
);
export default AssetReport;
