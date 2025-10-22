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
/**
 * Build beautiful cover page HTML
 */
function buildCoverPageHTML(data: {
  logoUrl?: string;
  companyName: string;
  title: string;
  subtitle?: string;
  clientName: string;
  reportDate: string;
  additionalInfo?: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cover Page</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 1400px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    
    .cover-container {
      width: 100%;
      height: 1400px;
      background: linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #1e3c72 100%);
      position: relative;
      overflow: hidden;
    }
    
    .cover-container::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -20%;
      width: 800px;
      height: 800px;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
      border-radius: 50%;
    }
    
    .cover-container::after {
      content: '';
      position: absolute;
      bottom: -30%;
      left: -10%;
      width: 600px;
      height: 600px;
      background: radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%);
      border-radius: 50%;
    }
    
    .content-wrapper {
      position: relative;
      z-index: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 80px 100px;
    }
    
    .header-section {
      text-align: center;
    }
    
    .logo {
      width: 280px;
      height: auto;
      margin: 0 auto 40px;
      filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3));
    }
    
    .company-name {
      font-size: 48px;
      font-weight: 300;
      color: #ffffff;
      letter-spacing: 4px;
      text-transform: uppercase;
      margin-bottom: 20px;
      text-shadow: 2px 2px 8px rgba(0,0,0,0.3);
    }
    
    .divider {
      width: 200px;
      height: 3px;
      background: linear-gradient(90deg, transparent, #D4AF37, transparent);
      margin: 0 auto 60px;
    }
    
    .title-section {
      text-align: center;
      margin: 100px 0;
    }
    
    .main-title {
      font-size: 72px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 30px;
      text-shadow: 3px 3px 12px rgba(0,0,0,0.4);
      line-height: 1.2;
    }
    
    .subtitle {
      font-size: 32px;
      font-weight: 300;
      color: #D4AF37;
      font-style: italic;
      margin-bottom: 60px;
    }
    
    .info-cards {
      display: flex;
      justify-content: center;
      gap: 40px;
      margin-top: 60px;
    }
    
    .info-card {
      background: rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 20px;
      padding: 40px 60px;
      min-width: 350px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }
    
    .info-label {
      font-size: 16px;
      font-weight: 600;
      color: #D4AF37;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 15px;
    }
    
    .info-value {
      font-size: 28px;
      font-weight: 600;
      color: #ffffff;
    }
    
    .footer-section {
      text-align: center;
      padding-top: 40px;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
    }
    
    .footer-text {
      font-size: 18px;
      color: rgba(255, 255, 255, 0.8);
    }
  </style>
</head>
<body>
  <div class="cover-container">
    <div class="content-wrapper">
      <div class="header-section">
        <div class="company-name">${data.companyName}</div>
        <div class="divider"></div>
      </div>
      
      <div class="title-section">
        <h1 class="main-title">${data.title}</h1>
        ${data.subtitle ? `<p class="subtitle">${data.subtitle}</p>` : ''}
        
        <div class="info-cards">
          <div class="info-card">
            <div class="info-label">Prepared For</div>
            <div class="info-value">${data.clientName}</div>
          </div>
          <div class="info-card">
            <div class="info-label">Date</div>
            <div class="info-value">${data.reportDate}</div>
          </div>
        </div>
      </div>
      
      <div class="footer-section">
        ${data.additionalInfo ? `<p class="footer-text">${data.additionalInfo}</p>` : ''}
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Build professional certificate HTML
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
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #f8f9fa;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 1600px;
      padding: 60px;
    }
    
    .certificate-container {
      width: 1100px;
      background: #ffffff;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
      position: relative;
      overflow: hidden;
    }
    
    .certificate-header {
      background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
      padding: 60px;
      text-align: center;
      position: relative;
    }
    
    .certificate-header::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 6px;
      background: #D4AF37;
    }
    
    .certificate-title {
      font-size: 52px;
      font-weight: 700;
      color: #ffffff;
      text-transform: uppercase;
      letter-spacing: 6px;
      margin-bottom: 20px;
    }
    
    .certificate-subtitle {
      font-size: 22px;
      color: #D4AF37;
      font-weight: 500;
      letter-spacing: 3px;
      text-transform: uppercase;
    }
    
    .certificate-body {
      padding: 70px 90px;
    }
    
    .certificate-statement {
      text-align: center;
      font-size: 19px;
      color: #4B5563;
      line-height: 1.9;
      margin-bottom: 60px;
      font-weight: 400;
    }
    
    .value-showcase {
      background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
      border-radius: 10px;
      padding: 50px;
      text-align: center;
      margin: 60px 0;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      position: relative;
    }
    
    .value-showcase::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: #D4AF37;
    }
    
    .value-label {
      font-size: 20px;
      color: #D4AF37;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 4px;
      margin-bottom: 25px;
    }
    
    .value-amount {
      font-size: 64px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 2px;
    }
    
    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 25px;
      margin: 60px 0;
    }
    
    .detail-item {
      background: #f8f9fa;
      border-left: 4px solid #1e3c72;
      padding: 28px 35px;
      border-radius: 6px;
    }
    
    .detail-label {
      font-size: 14px;
      color: #6B7280;
      font-weight: 600;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    
    .detail-value {
      font-size: 22px;
      color: #1F2937;
      font-weight: 600;
    }
    
    .signature-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 80px;
      margin-top: 90px;
      padding-top: 50px;
      border-top: 2px solid #E5E7EB;
    }
    
    .signature-box {
      text-align: center;
    }
    
    .signature-line {
      border-top: 2px solid #1F2937;
      margin-bottom: 20px;
      padding-top: 70px;
    }
    
    .signature-label {
      font-size: 16px;
      color: #6B7280;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .footer-bar {
      background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
      padding: 30px;
      text-align: center;
      margin-top: 60px;
    }
    
    .footer-text {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.9);
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <div class="certificate-container">
    <div class="certificate-header">
      <h1 class="certificate-title">${data.title || "Certificate of Appraisal"}</h1>
      <p class="certificate-subtitle">Professional Business Valuation</p>
    </div>
    
    <div class="certificate-body">
      <p class="certificate-statement">
        This document certifies that a comprehensive professional appraisal has been conducted 
        in accordance with applicable industry standards and regulatory requirements. The 
        valuation opinion presented herein represents our professional expertise and thorough 
        market analysis.
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
          <div class="signature-label">Authorized Signature</div>
        </div>
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-label">Date: ${data.reportDate || '—'}</div>
        </div>
      </div>
    </div>
    
    <div class="footer-bar">
      <p class="footer-text">This certificate is valid for business purposes and complies with professional appraisal standards.</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate cover page image from data
 */
export async function generateCoverPageImage(
  coverData: {
    companyName: string;
    title: string;
    subtitle?: string;
    clientName: string;
    reportDate: string;
    additionalInfo?: string;
  }
): Promise<Buffer> {
  const html = buildCoverPageHTML(coverData);

  return await htmlToImageBuffer(html, {
    width: 1200,
    height: 1400,
    format: "png",
    quality: 95,
  });
}
