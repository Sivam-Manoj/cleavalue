/**
 * Modern, stunning CSS styles for HTML-to-DOCX conversion
 * Features: Gradients, shadows, modern typography, professional color palette
 */

export function getModernStyles(): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
      font-size: 13pt;
      color: #111827;
      line-height: 1.6;
      background: white;
    }
    
    /* Modern Cover Page */
    .cover-page {
      text-align: center;
      page-break-after: always;
      padding: 100px 60px;
      background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
    }
    
    .hero-image {
      width: 600px;
      max-width: 100%;
      height: 400px;
      object-fit: cover;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
      margin-bottom: 50px;
      border: 8px solid white;
    }
    
    .cover-title {
      font-size: 56pt;
      font-weight: 700;
      color: #1F2937;
      margin: 40px 0 30px 0;
      letter-spacing: -1px;
    }
    
    .cover-subtitle {
      font-size: 24pt;
      color: #6B7280;
      line-height: 1.8;
    }
    
    /* Stunning Certificate */
    .certificate-page {
      page-break-before: always;
      padding: 60px;
      background: linear-gradient(135deg, #fafafa 0%, #ffffff 100%);
    }
    
    .certificate-container {
      border: 20px double #D4AF37;
      background: white;
      padding: 80px 60px;
      text-align: center;
      border-radius: 30px;
      box-shadow: 0 20px 60px rgba(212, 175, 55, 0.2);
    }
    
    .certificate-title {
      font-size: 58pt;
      font-weight: 700;
      color: #1F2937;
      margin-bottom: 40px;
      letter-spacing: 2px;
      border-bottom: 8px solid #D4AF37;
      padding-bottom: 20px;
    }
    
    .certificate-statement {
      font-size: 20pt;
      color: #4B5563;
      margin: 50px auto;
      line-height: 1.8;
      font-style: italic;
    }
    
    .value-showcase {
      background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 50%, #FCD34D 100%);
      border: 3px solid #D4AF37;
      padding: 50px;
      margin: 50px auto;
      width: 75%;
      border-radius: 25px;
      box-shadow: 0 15px 40px rgba(212, 175, 55, 0.3);
    }
    
    .value-label {
      font-size: 22pt;
      color: #92400E;
      font-weight: 700;
      margin-bottom: 20px;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    
    .value-amount {
      font-size: 52pt;
      font-weight: 900;
      color: #059669;
      text-shadow: 3px 3px 6px rgba(5, 150, 105, 0.2);
    }
    
    .certificate-details {
      margin-top: 60px;
      width: 100%;
      border-collapse: collapse;
    }
    
    .certificate-details th {
      background: linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 100%);
      padding: 22px 30px;
      border: 1px solid #E5E7EB;
      font-weight: 700;
      text-align: left;
      font-size: 20pt;
      color: #1F2937;
      width: 35%;
    }
    
    .certificate-details td {
      padding: 22px 30px;
      border: 1px solid #E5E7EB;
      font-size: 20pt;
      color: #374151;
      background: white;
    }
    
    .signature-section {
      margin-top: 80px;
    }
    
    .signature-box {
      display: inline-block;
      width: 45%;
      text-align: center;
      margin: 0 2%;
    }
    
    .signature-line {
      border-top: 3px double #1F2937;
      margin-bottom: 15px;
      padding-top: 100px;
    }
    
    .signature-label {
      font-size: 16pt;
      color: #6B7280;
      font-weight: 600;
    }
    
    /* Modern Table of Contents */
    .toc-page {
      page-break-before: always;
      padding: 60px 40px;
    }
    
    .toc-title {
      font-size: 48pt;
      font-weight: 700;
      color: #1F2937;
      margin-bottom: 30px;
      border-bottom: 6px solid #D4AF37;
      padding-bottom: 15px;
    }
    
    .toc-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 40px;
    }
    
    .toc-table thead {
      background: linear-gradient(135deg, #1F2937 0%, #374151 100%);
      color: white;
    }
    
    .toc-table th {
      padding: 18px 20px;
      font-size: 18pt;
      font-weight: 700;
      text-align: left;
      border-bottom: 3px solid #D4AF37;
    }
    
    .toc-table td {
      padding: 14px 20px;
      border-bottom: 1px solid #E5E7EB;
      font-size: 16pt;
    }
    
    .toc-table tr:nth-child(even) {
      background: #F9FAFB;
    }
    
    .toc-table td:last-child {
      text-align: right;
      color: #6B7280;
      font-weight: 600;
    }
    
    /* Section Headers */
    h1 {
      font-size: 36pt;
      font-weight: 700;
      color: #1F2937;
      margin: 40px 0 20px 0;
      padding-bottom: 15px;
      border-bottom: 5px solid #D4AF37;
    }
    
    h2 {
      font-size: 28pt;
      font-weight: 600;
      color: #374151;
      margin: 30px 0 15px 0;
      padding-left: 20px;
      border-left: 6px solid #D4AF37;
    }
    
    h3 {
      font-size: 22pt;
      font-weight: 600;
      color: #4B5563;
      margin: 25px 0 12px 0;
    }
    
    p {
      margin-bottom: 15px;
      color: #374151;
      line-height: 1.8;
    }
    
    /* Results Table */
    .results-table {
      width: 100%;
      border-collapse: collapse;
      margin: 30px 0;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      border-radius: 12px;
      overflow: hidden;
    }
    
    .results-table thead {
      background: linear-gradient(135deg, #1F2937 0%, #374151 100%);
      color: white;
    }
    
    .results-table th {
      padding: 18px 15px;
      font-weight: 700;
      text-align: left;
      font-size: 16pt;
      border-bottom: 3px solid #D4AF37;
    }
    
    .results-table tbody tr:nth-child(even) {
      background: linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 100%);
    }
    
    .results-table td {
      padding: 15px;
      border-bottom: 1px solid #E5E7EB;
      font-size: 14pt;
      color: #374151;
    }
    
    /* Valuation Table */
    .valuation-table {
      width: 100%;
      border-collapse: collapse;
      margin: 40px 0;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
      border-radius: 15px;
      overflow: hidden;
    }
    
    .valuation-table thead {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      color: white;
    }
    
    .valuation-table th {
      padding: 20px;
      font-size: 18pt;
      font-weight: 700;
      text-align: left;
    }
    
    .valuation-table tbody tr {
      background: white;
      border-bottom: 2px solid #E5E7EB;
    }
    
    .valuation-table tbody tr:nth-child(even) {
      background: #ECFDF5;
    }
    
    .valuation-table td {
      padding: 18px 20px;
      font-size: 16pt;
    }
    
    .valuation-table .method-name {
      font-weight: 700;
      color: #1F2937;
    }
    
    .valuation-table .percentage {
      color: #059669;
      font-weight: 700;
      font-size: 18pt;
    }
    
    .valuation-table .value {
      color: #1F2937;
      font-weight: 700;
      font-size: 18pt;
    }
    
    /* Info Boxes */
    .info-box {
      background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%);
      border-left: 6px solid #3B82F6;
      padding: 25px 30px;
      margin: 25px 0;
      border-radius: 10px;
    }
    
    .warning-box {
      background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
      border-left: 6px solid #F59E0B;
      padding: 25px 30px;
      margin: 25px 0;
      border-radius: 10px;
    }
    
    .success-box {
      background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%);
      border-left: 6px solid #059669;
      padding: 25px 30px;
      margin: 25px 0;
      border-radius: 10px;
    }
    
    /* Gold Divider */
    .gold-divider {
      height: 4px;
      background: linear-gradient(90deg, transparent, #D4AF37, transparent);
      margin: 40px 0;
      border-radius: 2px;
    }
    
    /* Footer */
    .footer {
      page-break-before: always;
      text-align: center;
      padding: 60px 40px;
      background: linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 100%);
      border-top: 4px solid #D4AF37;
      margin-top: 60px;
    }
    
    .footer p {
      font-size: 14pt;
      color: #6B7280;
      margin: 12px 0;
      line-height: 1.8;
    }
    
    .footer-address {
      font-size: 15pt;
      color: #4B5563;
      font-weight: 600;
      margin-bottom: 15px;
    }
    
    .footer-website {
      font-size: 16pt;
      color: #3B82F6;
      font-weight: 700;
    }
    
    /* Transmittal Letter */
    .transmittal {
      page-break-before: always;
      padding: 40px;
      line-height: 2;
    }
    
    .transmittal-header {
      margin-bottom: 50px;
    }
    
    .transmittal-date {
      font-size: 14pt;
      color: #6B7280;
      margin-bottom: 30px;
    }
    
    .transmittal-recipient {
      font-size: 16pt;
      font-weight: 600;
      color: #1F2937;
      margin-bottom: 10px;
    }
    
    .transmittal-body {
      font-size: 14pt;
      color: #374151;
      line-height: 2;
      text-align: justify;
    }
    
    .transmittal-signature {
      margin-top: 80px;
    }
    
    .page-break {
      page-break-before: always;
    }
  `;
}
