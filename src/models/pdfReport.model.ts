import mongoose, { Schema, Document } from 'mongoose';

export interface IPdfReport extends Document {
  filename: string;
  address: string;
  fairMarketValue: string;
  user: mongoose.Schema.Types.ObjectId;
  report: mongoose.Schema.Types.ObjectId;
  reportType: 'RealEstate' | 'Salvage' | 'Asset';
  reportModel: 'RealEstateReport' | 'SalvageReport' | 'AssetReport';
  fileType?: 'pdf' | 'docx' | 'xlsx' | 'images';
  filePath?: string; // relative path like "reports/<filename>"
  imagesFolderPath?: string; // optional: for 'images' type, relative folder path containing original images
  createdAt: Date;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvalNote?: string;
  reviewedBy?: mongoose.Schema.Types.ObjectId | null;
  reviewedAt?: Date | null;
  contract_no?: string;
}

const PdfReportSchema: Schema = new Schema(
  {
    filename: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      enum: ['pdf', 'docx', 'xlsx', 'images'],
      required: false,
      index: true,
    },
    filePath: {
      type: String,
      required: false,
      default: '',
    },
    imagesFolderPath: {
      type: String,
      required: false,
      default: '',
    },
    address: {
      type: String,
      required: true,
    },
    fairMarketValue: {
      type: String,
      required: true,
    },
    contract_no: {
      type: String,
      required: false,
      default: '',
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reportType: {
      type: String,
      enum: ['RealEstate', 'Salvage', 'Asset'],
      required: true,
    },
    reportModel: {
      type: String,
      enum: ['RealEstateReport', 'SalvageReport', 'AssetReport'],
      required: true,
    },
    report: {
      type: Schema.Types.ObjectId,
      refPath: 'reportModel',
      required: true,
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    approvalNote: {
      type: String,
      default: '',
      maxlength: 2000,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const PdfReport = mongoose.model<IPdfReport>('PdfReport', PdfReportSchema);

export default PdfReport;
