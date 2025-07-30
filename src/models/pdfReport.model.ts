import mongoose, { Schema, Document } from 'mongoose';

export interface IPdfReport extends Document {
  filename: string;
  address: string;
  fairMarketValue: string;
  user: mongoose.Schema.Types.ObjectId;
  report: mongoose.Schema.Types.ObjectId;
  createdAt: Date;
}

const PdfReportSchema: Schema = new Schema(
  {
    filename: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    fairMarketValue: {
      type: String,
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    report: {
        type: Schema.Types.ObjectId,
        ref: 'RealEstateReport',
        required: true,
    }
  },
  { timestamps: true }
);

const PdfReport = mongoose.model<IPdfReport>('PdfReport', PdfReportSchema);

export default PdfReport;
