import {
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  TabStopType,
  TabStopPosition,
  PageNumber,
} from "docx";
import { goldDivider } from "./utils.js";
import { getLang, t } from "./i18n.js";

export function buildTOC(reportData: any): Array<Paragraph | Table> {
  const lang = getLang(reportData);
  const tr = t(lang);
  const entries: { label: string }[] = [];
  
  // Order matches the actual document structure
  // Page numbering starts from Transmittal Letter (page 1)
  
  // 1. Transmittal Letter - Page 1
  entries.push({ label: tr.transmittalLetter });
  
  // 2. Certificate of Appraisal - Page 2
  entries.push({ label: tr.certificateOfAppraisal });
  
  // Main content sections start from Page 3+
  // 3. Report Summary
  entries.push({ label: tr.reportSummary });
  
  // 4. Summary of Value Conclusions
  entries.push({ label: tr.summaryOfValue });
  
  // 5. Report Details
  entries.push({ label: tr.reportDetails });
  
  // 6. Conditions of Appraisal
  entries.push({ label: tr.conditionsHeading });
  
  // 7. Purpose of This Report
  entries.push({ label: tr.purposeHeading });
  
  // 8. Identification of Assets Appraised
  entries.push({ label: tr.identHeading });
  
  // 9. Scope of Work
  entries.push({ label: tr.scopeHeading });
  
  // 10. Observations and Comments
  entries.push({ label: tr.observationsHeading });
  
  // 11. Intended Users
  entries.push({ label: tr.intendedHeading });
  
  // 12. Value Terminology
  entries.push({ label: tr.valueTermHeading });
  
  // 13. Definitions and Obsolescence
  entries.push({ label: tr.definitionsHeading });
  
  // 14. Limiting Conditions and Critical Assumptions
  entries.push({ label: tr.limitingHeading });
  
  // 15. Company, Subject Asset Description
  entries.push({ label: tr.companySubjectHeading });
  
  // 16. Approaches to Value
  entries.push({ label: tr.approachesHeading });
  
  // 17. Valuation Process and Methodology
  entries.push({ label: tr.valProcessHeading });
  
  // 18. Code of Ethics
  entries.push({ label: tr.codeEthicsHeading });
  
  // 19. Experience
  entries.push({ label: tr.experienceHeading });
  
  // 20. Results (lots/catalogue/per_item/combined)
  const gm = String(reportData?.grouping_mode || "");
  if (gm === "combined") {
    const modes: string[] = Array.isArray(reportData?.combined_modes)
      ? reportData.combined_modes
      : ["per_item", "per_photo", "single_lot"];
    if (modes.includes("per_item")) entries.push({ label: tr.perItemResults });
    if (modes.includes("per_photo")) entries.push({ label: tr.perPhotoResults });
    if (modes.includes("single_lot")) entries.push({ label: tr.singleLotResults });
  } else if (Array.isArray(reportData?.lots) && reportData.lots.length) {
    if (gm === "catalogue") entries.push({ label: tr.assetCatalogue });
    else if (gm === "per_item") entries.push({ label: tr.perItemResults });
    else entries.push({ label: tr.results });
  }
  
  // 21. Market Overview
  entries.push({ label: tr.marketOverview });
  
  // 22. Appendix
  const hasImages =
    Array.isArray(reportData?.imageUrls) && reportData.imageUrls.length > 0;
  if (hasImages) entries.push({ label: tr.appendix });

  const headerRow = new TableRow({
    cantSplit: true,
    children: [
      new TableCell({
        children: [
          new Paragraph({
            children: [new TextRun({ text: tr.section, bold: true })],
          }),
        ],
      }),
      new TableCell({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: tr.page.trim(), bold: true })],
          }),
        ],
      }),
    ],
  });

  const rows: TableRow[] = [headerRow];
  let pageNum = 1; // Starting page number estimate
  
  for (const e of entries) {
    rows.push(
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: e.label, size: 22 }),
                  new TextRun({ text: " ", size: 18 }),
                  new TextRun({ text: ".".repeat(80), size: 16, color: "D1D5DB" }),
                ],
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: pageNum.toString(), size: 22 })],
              }),
            ],
          }),
        ],
      })
    );
    pageNum++; // Increment for next section
  }

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [Math.round(9040 * 0.8), Math.round(9040 * 0.2)],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
      insideVertical: { style: BorderStyle.SINGLE, size: 0, color: "FFFFFF" },
    },
    rows,
  });

  return [
    new Paragraph({
      text: tr.tableOfContents,
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 120 },
    }),
    goldDivider(),
    table,
  ];
}
