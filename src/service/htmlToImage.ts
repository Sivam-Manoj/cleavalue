import puppeteer from "puppeteer";
import Jimp from "jimp";

/**
 * Convert HTML string to image buffer using Puppeteer
 * @param html - The HTML string to render
 * @param options - Rendering options
 * @returns Buffer containing the image
 */
export async function htmlToImageBuffer(
  html: string,
  options: {
    width?: number;
    height?: number;
    format?: "png" | "jpeg";
    quality?: number;
  } = {}
): Promise<Buffer> {
  const { width = 1200, height = 1600, format = "png", quality = 95 } = options;

  let browser;
  try {
    // Launch headless browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();

    // Set viewport size
    await page.setViewport({
      width,
      height,
      deviceScaleFactor: 2, // High DPI for better quality
    });

    // Set HTML content
    await page.setContent(html, {
      waitUntil: "networkidle0",
    });

    // Take screenshot
    const screenshotBuffer = await page.screenshot({
      type: format,
      quality: format === "jpeg" ? quality : undefined,
      fullPage: false,
    });

    await browser.close();

    // Optimize with Jimp
    const buffer = Buffer.from(screenshotBuffer);
    const image = await Jimp.read(buffer);

    if (format === "png") {
      return await image.quality(quality).getBufferAsync(Jimp.MIME_PNG);
    } else {
      return await image.quality(quality).getBufferAsync(Jimp.MIME_JPEG);
    }
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    console.error("Error converting HTML to image:", error);
    throw new Error("Failed to convert HTML to image");
  }
}

/**
 * Generate certificate image from data
 * @param certificateData - Data for the certificate
 * @returns Buffer containing the certificate image
 */
export async function generateCertificateImage(certificateData: {
  title: string;
  clientName: string;
  effectiveDate: string;
  purpose: string;
  preparedBy: string;
  totalValue?: string;
  appraiserSignature?: string;
  reportDate: string;
}): Promise<Buffer> {
  const html = buildCertificateHTML(certificateData);

  return await htmlToImageBuffer(html, {
    width: 1200,
    height: 1600,
    format: "png",
    quality: 95,
  });
}

/**
 * Build beautiful certificate HTML
 */
function buildCertificateHTML(data: {
  title: string;
  clientName: string;
  effectiveDate: string;
  purpose: string;
  preparedBy: string;
  totalValue?: string;
  appraiserSignature?: string;
  reportDate: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate of Appraisal</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 1600px;
      padding: 40px;
    }
    
    .certificate-container {
      width: 1120px;
      background: #ffffff;
      border: 20px solid #D4AF37;
      border-radius: 20px;
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.3);
      position: relative;
      overflow: hidden;
    }
    
    .certificate-container::before {
      content: '';
      position: absolute;
      top: 20px;
      left: 20px;
      right: 20px;
      bottom: 20px;
      border: 3px solid #D4AF37;
      border-radius: 10px;
      pointer-events: none;
    }
    
    .certificate-header {
      background: linear-gradient(135deg, #D4AF37 0%, #F4E8C1 50%, #D4AF37 100%);
      padding: 50px 60px;
      text-align: center;
      position: relative;
    }
    
    .certificate-header::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 200px;
      height: 4px;
      background: linear-gradient(90deg, transparent, #8B7355, transparent);
    }
    
    .certificate-title {
      font-size: 62px;
      font-weight: 700;
      color: #1F2937;
      text-transform: uppercase;
      letter-spacing: 8px;
      margin-bottom: 15px;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .certificate-subtitle {
      font-size: 24px;
      color: #4B5563;
      font-style: italic;
      letter-spacing: 2px;
    }
    
    .certificate-body {
      padding: 60px 80px;
    }
    
    .certificate-statement {
      text-align: center;
      font-size: 22px;
      color: #374151;
      line-height: 1.8;
      margin-bottom: 50px;
      font-style: italic;
    }
    
    .value-showcase {
      background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 50%, #FCD34D 100%);
      border: 6px double #D4AF37;
      border-radius: 15px;
      padding: 40px;
      text-align: center;
      margin: 50px 0;
      box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.1),
                  0 8px 20px rgba(212, 175, 55, 0.3);
    }
    
    .value-label {
      font-size: 26px;
      color: #92400E;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 3px;
      margin-bottom: 20px;
    }
    
    .value-amount {
      font-size: 68px;
      font-weight: 900;
      color: #059669;
      text-shadow: 3px 3px 6px rgba(5, 150, 105, 0.2);
      letter-spacing: 2px;
    }
    
    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin: 50px 0;
    }
    
    .detail-item {
      background: linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 100%);
      border-left: 5px solid #D4AF37;
      padding: 25px 30px;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }
    
    .detail-label {
      font-size: 18px;
      color: #6B7280;
      font-weight: 600;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .detail-value {
      font-size: 24px;
      color: #1F2937;
      font-weight: 700;
    }
    
    .signature-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 60px;
      margin-top: 80px;
      padding-top: 40px;
      border-top: 2px solid #E5E7EB;
    }
    
    .signature-box {
      text-align: center;
    }
    
    .signature-line {
      border-top: 3px double #1F2937;
      margin-bottom: 15px;
      padding-top: 60px;
    }
    
    .signature-label {
      font-size: 20px;
      color: #6B7280;
      font-weight: 600;
    }
    
    .decorative-corner {
      position: absolute;
      width: 80px;
      height: 80px;
      border: 3px solid #D4AF37;
    }
    
    .decorative-corner.top-left {
      top: 40px;
      left: 40px;
      border-right: none;
      border-bottom: none;
      border-radius: 10px 0 0 0;
    }
    
    .decorative-corner.top-right {
      top: 40px;
      right: 40px;
      border-left: none;
      border-bottom: none;
      border-radius: 0 10px 0 0;
    }
    
    .decorative-corner.bottom-left {
      bottom: 40px;
      left: 40px;
      border-right: none;
      border-top: none;
      border-radius: 0 0 0 10px;
    }
    
    .decorative-corner.bottom-right {
      bottom: 40px;
      right: 40px;
      border-left: none;
      border-top: none;
      border-radius: 0 0 10px 0;
    }
    
    .seal-watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-15deg);
      opacity: 0.03;
      font-size: 300px;
      font-weight: 900;
      color: #D4AF37;
      pointer-events: none;
      z-index: 0;
    }
    
    .certificate-body > * {
      position: relative;
      z-index: 1;
    }
  </style>
</head>
<body>
  <div class="certificate-container">
    <div class="decorative-corner top-left"></div>
    <div class="decorative-corner top-right"></div>
    <div class="decorative-corner bottom-left"></div>
    <div class="decorative-corner bottom-right"></div>
    
    <div class="certificate-header">
      <h1 class="certificate-title">${data.title || "Certificate of Appraisal"}</h1>
      <p class="certificate-subtitle">Professional Asset Valuation</p>
    </div>
    
    <div class="certificate-body">
      <div class="seal-watermark">CERTIFIED</div>
      
      <p class="certificate-statement">
        This certifies that a professional appraisal has been conducted in accordance 
        with industry standards and best practices. The valuation represents our expert 
        opinion based on thorough analysis and inspection.
      </p>
      
      ${
        data.totalValue
          ? `
      <div class="value-showcase">
        <div class="value-label">Total Appraised Value</div>
        <div class="value-amount">${data.totalValue}</div>
      </div>
      `
          : ""
      }
      
      <div class="details-grid">
        <div class="detail-item">
          <div class="detail-label">Client</div>
          <div class="detail-value">${data.clientName || "—"}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Effective Date</div>
          <div class="detail-value">${data.effectiveDate || "—"}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Purpose</div>
          <div class="detail-value">${data.purpose || "—"}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Prepared By</div>
          <div class="detail-value">${data.preparedBy || "—"}</div>
        </div>
      </div>
      
      <div class="signature-section">
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-label">Appraiser Signature</div>
        </div>
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-label">Date: ${data.reportDate || "—"}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}
