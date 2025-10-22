import { formatDateUS } from '../builders/utils.js';

export function buildCoverPageHTML(data: any): string {
  const date = formatDateUS(data.createdAt || new Date().toISOString());
  const heroImage = data.imageUrls && data.imageUrls.length > 0 ? data.imageUrls[0] : '';
  
  return `
    <div class="cover-page">
      ${heroImage ? `<img src="${heroImage}" class="hero-image" alt="Report Asset">` : ''}
      
      <div style="font-size: 64pt; font-weight: 700; color: #1F2937; margin: 40px 0;">
        McDougall<br>Auctioneers
      </div>
      
      <h1 class="cover-title">Asset Appraisal Report</h1>
      
      <div class="cover-subtitle">
        <p style="margin: 15px 0;">Prepared for: <strong>${data.client_name || data.owner_name || '—'}</strong></p>
        <p style="margin: 15px 0;">Report Date: <strong>${date}</strong></p>
        ${data.contract_no ? `<p style="margin: 15px 0;">Contract No: <strong>${data.contract_no}</strong></p>` : ''}
      </div>
    </div>
  `;
}

export function buildTableOfContentsHTML(data: any): string {
  const sections = [
    'Report Summary',
    'Summary of Value Conclusions',
    'Report Details',
    'Conditions of Appraisal',
    'Purpose of This Report',
    'Identification of Assets Appraised',
    'Scope of Work',
    'Observations and Comments',
    'Intended Users',
    'Value Terminology',
    'Definitions and Obsolescence',
    'Limiting Conditions and Critical Assumptions',
    'Company, Subject Asset Description',
    'Approaches to Value',
    'Valuation Process and Methodology',
    'Code of Ethics',
    'Experience',
    'Transmittal Letter',
    'Certificate of Appraisal',
    'Results',
    'Market Overview'
  ];
  
  return `
    <div class="toc-page">
      <h1 class="toc-title">Table of Contents</h1>
      
      <div class="gold-divider"></div>
      
      <table class="toc-table">
        <thead>
          <tr>
            <th>Section</th>
            <th style="width: 100px;">Page</th>
          </tr>
        </thead>
        <tbody>
          ${sections.map((section) => `
            <tr>
              <td>${section}</td>
              <td>—</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="info-box" style="margin-top: 40px;">
        <p><strong>Note:</strong> To display page numbers, open this document in Microsoft Word, right-click on the Table of Contents, and select "Update Field" → "Update entire table".</p>
      </div>
    </div>
  `;
}

export function buildTransmittalLetterHTML(data: any): string {
  const date = formatDateUS(data.createdAt || new Date().toISOString());
  const recipient = data.client_name || data.owner_name || 'Valued Client';
  
  return `
    <div class="transmittal">
      <div class="transmittal-header">
        <div style="font-size: 24pt; font-weight: 700; color: #1F2937; margin-bottom: 40px;">
          McDougall Auctioneers
        </div>
        <div class="transmittal-date">${date}</div>
        <div class="transmittal-recipient">
          ${recipient}
        </div>
      </div>
      
      <h1 style="font-size: 32pt; margin-bottom: 30px;">Transmittal Letter</h1>
      <div class="gold-divider"></div>
      
      <div class="transmittal-body">
        <p>Dear ${recipient},</p>
        
        <p>We are pleased to present this comprehensive asset appraisal report prepared in accordance with professional standards and industry best practices.</p>
        
        <p>This report contains a detailed analysis of the assets under consideration, including our professional opinion of value based on thorough research, market analysis, and our extensive experience in the field.</p>
        
        <p>The appraisal has been conducted for the purpose of ${data.appraisal_purpose || 'asset valuation'}, with an effective date of ${formatDateUS(data.effective_date) || date}.</p>
        
        <p>Should you have any questions regarding the contents of this report or require any clarification, please do not hesitate to contact us.</p>
        
        <p>Thank you for the opportunity to be of service.</p>
      </div>
      
      <div class="transmittal-signature">
        <p style="font-weight: 600;">Sincerely,</p>
        <div style="height: 60px;"></div>
        <div style="border-top: 2px solid #1F2937; width: 300px; padding-top: 10px;">
          <p style="font-weight: 700;">${data.appraiser || 'Professional Appraiser'}</p>
          ${data.appraisal_company ? `<p>${data.appraisal_company}</p>` : ''}
          ${data.user_email ? `<p>${data.user_email}</p>` : ''}
        </div>
      </div>
    </div>
  `;
}

export function buildCertificateHTML(data: any): string {
  const date = formatDateUS(data.createdAt || new Date().toISOString());
  const effectiveDate = formatDateUS(data.effective_date) || date;
  const totalValue = data.total_appraised_value || data.total_value || 'See Report Details';
  
  return `
    <div class="certificate-page">
      <div class="certificate-container">
        <h1 class="certificate-title">CERTIFICATE OF APPRAISAL</h1>
        
        <p class="certificate-statement">
          This certifies that the assets described herein have been appraised in accordance 
          with professional standards and that the opinions expressed are our true and considered 
          professional judgments.
        </p>
        
        <div class="value-showcase">
          <div class="value-label">Total Appraised Value</div>
          <div class="value-amount">${totalValue}</div>
        </div>
        
        <table class="certificate-details">
          <tr>
            <th>Client</th>
            <td>${data.client_name || data.owner_name || '—'}</td>
          </tr>
          <tr>
            <th>Effective Date</th>
            <td>${effectiveDate}</td>
          </tr>
          <tr>
            <th>Purpose</th>
            <td>${data.appraisal_purpose || '—'}</td>
          </tr>
          <tr>
            <th>Prepared By</th>
            <td>${[data.appraiser, data.appraisal_company].filter(Boolean).join(', ') || '—'}</td>
          </tr>
          ${data.contract_no ? `
          <tr>
            <th>Contract No</th>
            <td>${data.contract_no}</td>
          </tr>
          ` : ''}
        </table>
        
        <div class="signature-section">
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-label">Appraiser Signature</div>
          </div>
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-label">Date: ${date}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function buildReportSectionsHTML(data: any): string {
  const date = formatDateUS(data.createdAt || new Date().toISOString());
  const totalValue = data.total_appraised_value || data.total_value || 'See Details';
  
  return `
    <div class="page-break">
      <h1>Report Summary</h1>
      <div class="gold-divider"></div>
      
      <div class="success-box">
        <h3>Summary of Value Conclusions</h3>
        <p><strong>Total Appraised Value:</strong> ${totalValue}</p>
        <p><strong>Effective Date:</strong> ${formatDateUS(data.effective_date) || date}</p>
        <p><strong>Purpose:</strong> ${data.appraisal_purpose || 'Asset Valuation'}</p>
      </div>
      
      <h2>Report Details</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="border-bottom: 1px solid #E5E7EB;">
          <td style="padding: 12px; font-weight: 600; color: #1F2937;">Client</td>
          <td style="padding: 12px; color: #374151;">${data.client_name || data.owner_name || '—'}</td>
        </tr>
        <tr style="border-bottom: 1px solid #E5E7EB;">
          <td style="padding: 12px; font-weight: 600; color: #1F2937;">Report Date</td>
          <td style="padding: 12px; color: #374151;">${date}</td>
        </tr>
        ${data.contract_no ? `
        <tr style="border-bottom: 1px solid #E5E7EB;">
          <td style="padding: 12px; font-weight: 600; color: #1F2937;">Contract No</td>
          <td style="padding: 12px; color: #374151;">${data.contract_no}</td>
        </tr>
        ` : ''}
        <tr style="border-bottom: 1px solid #E5E7EB;">
          <td style="padding: 12px; font-weight: 600; color: #1F2937;">Appraiser</td>
          <td style="padding: 12px; color: #374151;">${data.appraiser || '—'}</td>
        </tr>
        ${data.appraisal_company ? `
        <tr style="border-bottom: 1px solid #E5E7EB;">
          <td style="padding: 12px; font-weight: 600; color: #1F2937;">Company</td>
          <td style="padding: 12px; color: #374151;">${data.appraisal_company}</td>
        </tr>
        ` : ''}
      </table>
      
      ${buildDetailedSections(data)}
    </div>
  `;
}

function buildDetailedSections(data: any): string {
  let html = '';
  
  // Conditions of Appraisal
  if (data.conditions) {
    html += `
      <div class="page-break">
        <h1>Conditions of Appraisal</h1>
        <div class="gold-divider"></div>
        <p>${data.conditions}</p>
      </div>
    `;
  }
  
  // Purpose
  if (data.purpose_description) {
    html += `
      <div class="page-break">
        <h1>Purpose of This Report</h1>
        <div class="gold-divider"></div>
        <p>${data.purpose_description}</p>
      </div>
    `;
  }
  
  // Identification
  if (data.identification) {
    html += `
      <div class="page-break">
        <h1>Identification of Assets Appraised</h1>
        <div class="gold-divider"></div>
        <p>${data.identification}</p>
      </div>
    `;
  }
  
  // Scope of Work
  if (data.scope_of_work) {
    html += `
      <div class="page-break">
        <h1>Scope of Work</h1>
        <div class="gold-divider"></div>
        <p>${data.scope_of_work}</p>
      </div>
    `;
  }
  
  // Additional sections
  const sections = [
    { key: 'observations', title: 'Observations and Comments' },
    { key: 'intended_users', title: 'Intended Users' },
    { key: 'value_terminology', title: 'Value Terminology' },
    { key: 'definitions', title: 'Definitions and Obsolescence' },
    { key: 'limiting_conditions', title: 'Limiting Conditions and Critical Assumptions' },
    { key: 'company_description', title: 'Company, Subject Asset Description' },
    { key: 'approaches_to_value', title: 'Approaches to Value' },
    { key: 'valuation_methodology', title: 'Valuation Process and Methodology' },
    { key: 'code_of_ethics', title: 'Code of Ethics' },
    { key: 'experience', title: 'EXPERIENCE' }
  ];
  
  sections.forEach(({ key, title }) => {
    if (data[key]) {
      html += `
        <div class="page-break">
          <h1>${title}</h1>
          <div class="gold-divider"></div>
          <p>${data[key]}</p>
        </div>
      `;
    }
  });
  
  return html;
}

export function buildResultsHTML(data: any): string {
  if (!data.lots || data.lots.length === 0) {
    return '';
  }
  
  const currency = data.currency || '$';
  let html = `
    <div class="page-break">
      <h1>Results</h1>
      <div class="gold-divider"></div>
  `;
  
  // Build results table based on grouping mode
  data.lots.forEach((lot: any, index: number) => {
    html += `
      <h2>Lot ${lot.lot_number || index + 1}: ${lot.lot_name || 'Untitled'}</h2>
      
      ${lot.lot_description ? `<p>${lot.lot_description}</p>` : ''}
      
      <table class="results-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Description</th>
            <th>Estimated Value</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    if (lot.items && lot.items.length > 0) {
      lot.items.forEach((item: any) => {
        html += `
          <tr>
            <td><strong>${item.title || item.name || '—'}</strong></td>
            <td>${item.description || '—'}</td>
            <td><strong>${currency}${item.estimated_value || item.value || '0'}</strong></td>
          </tr>
        `;
      });
    }
    
    html += `
        </tbody>
      </table>
    `;
  });
  
  // Add Valuation Comparison Table if enabled
  if (data.include_valuation_table && data.valuation_data) {
    html += buildValuationTableHTML(data);
  }
  
  html += `</div>`;
  return html;
}

function buildValuationTableHTML(data: any): string {
  const methods = [
    { name: 'Fair Market Value (FML)', key: 'fml', percentage: 100 },
    { name: 'Trade/Kelly Value (TKV)', key: 'tkv', percentage: 70 },
    { name: 'Orderly Liquidation Value (OLV)', key: 'olv', percentage: 77 },
    { name: 'Forced Liquidation Value (FLV)', key: 'flv', percentage: 52 }
  ];
  
  let html = `
    <div class="page-break">
      <h2>Valuation Comparison Table</h2>
      <div class="gold-divider"></div>
      
      <table class="valuation-table">
        <thead>
          <tr>
            <th>Method</th>
            <th>Percentage</th>
            <th>Value</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  methods.forEach(method => {
    const percentage = data.valuation_data?.[`${method.key}_percentage`] || method.percentage;
    const value = data.valuation_data?.[method.key] || '—';
    const description = getValuationDescription(method.key);
    
    html += `
      <tr>
        <td class="method-name">${method.name}</td>
        <td class="percentage">${percentage}%</td>
        <td class="value">${value}</td>
        <td>${description}</td>
      </tr>
    `;
  });
  
  html += `
        </tbody>
      </table>
    </div>
  `;
  
  return html;
}

function getValuationDescription(key: string): string {
  const descriptions: Record<string, string> = {
    fml: 'The estimated amount for which a property should exchange on the date of valuation between a willing buyer and a willing seller in an arm\'s-length transaction.',
    tkv: 'The amount that a dealer would expect to pay for an asset when purchasing from another dealer in the normal course of business.',
    olv: 'An opinion of the gross amount, expressed in terms of money, that typically could be realized from a liquidation sale given a reasonable period of time to find a purchaser.',
    flv: 'An opinion of the gross amount, expressed in terms of money, that typically could be realized from a properly advertised and conducted public auction with the seller being compelled to sell with a sense of immediacy.'
  };
  return descriptions[key] || '';
}

export function buildFooterHTML(data: any): string {
  return `
    <div class="footer">
      <div style="font-size: 24pt; font-weight: 700; color: #1F2937; margin-bottom: 30px;">
        McDougall Auctioneers
      </div>
      
      <div class="gold-divider"></div>
      
      <p class="footer-address">
        301 – 15 Great Plains Road, Emerald Park, SK  S4L 1C6
      </p>
      
      <p>
        <a href="https://www.McDougallBay.com" class="footer-website">www.McDougallBay.com</a>
        <span style="margin: 0 15px; color: #9CA3AF;">•</span>
        <span class="footer-phone">(800) 263-4193</span>
      </p>
      
      ${data.appraiser || data.user_email ? `
      <p style="margin-top: 20px;">
        ${data.appraiser ? `<strong>Prepared by:</strong> ${data.appraiser}` : ''}
        ${data.appraiser && data.user_email ? '<span style="margin: 0 15px; color: #9CA3AF;">•</span>' : ''}
        ${data.user_email ? `<strong>Email:</strong> ${data.user_email}` : ''}
      </p>
      ` : ''}
    </div>
  `;
}
