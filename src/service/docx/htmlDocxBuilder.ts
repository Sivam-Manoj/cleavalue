import HTMLtoDOCX from "html-to-docx";
import { formatDateUS } from "./builders/utils.js";
import { getModernStyles } from "./htmlTemplates/styles.js";
import {
  buildCoverPageHTML,
  buildCertificateHTML,
  buildTableOfContentsHTML,
  buildTransmittalLetterHTML,
  buildReportSectionsHTML,
  buildResultsHTML,
  buildFooterHTML,
} from "./htmlTemplates/sections.js";

/**
 * NEW: HTML-based DOCX generation with amazing modern styling
 * Uses html-to-docx for much simpler, more powerful styling capabilities
 * This is a test version alongside the existing mixedDocxBuilder
 */

export async function generateHTMLDocx(reportData: any): Promise<Buffer> {
  const html = buildCompleteHTML(reportData);

  const docxBlob = await HTMLtoDOCX(html, null, {
    title: reportData.title || "Asset Appraisal Report",
    creator: reportData.appraiser || "McDougall Auctioneers",
    orientation: "portrait",
    margins: {
      top: 1440, // 1 inch
      right: 1440,
      bottom: 1440,
      left: 1440,
    },
  });

  // Convert Blob/ArrayBuffer to Buffer
  if (docxBlob instanceof ArrayBuffer) {
    return Buffer.from(docxBlob);
  }
  if (docxBlob instanceof Blob) {
    return Buffer.from(await docxBlob.arrayBuffer());
  }
  return docxBlob as Buffer;
}

function buildCompleteHTML(data: any): string {
  return `
<!DOCTYPE html>
<html lang="${data.language || "en"}">
<head>
  <meta charset="UTF-8">
  <title>${data.title || "Asset Appraisal Report"}</title>
  <style>
    ${getModernStyles()}
  </style>
</head>
<body>
  ${buildCoverPageHTML(data)}
  ${buildTableOfContentsHTML(data)}
  ${buildTransmittalLetterHTML(data)}
  ${buildCertificateHTML(data)}
  ${buildReportSectionsHTML(data)}
  ${buildResultsHTML(data)}
  ${buildFooterHTML(data)}
</body>
</html>
  `;
}
