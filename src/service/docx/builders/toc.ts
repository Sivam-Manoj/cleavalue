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

export function buildTOC(reportData: any, skipPageBreak = false): Array<Paragraph | Table> {
  const lang = getLang(reportData);
  const tr = t(lang);
  const entries: { label: string }[] = [];
  
  // Build table of contents based on actual document structure
  // Page numbering is estimated and starts from the transmittal letter
  
  // Core document sections
  entries.push({ label: tr.transmittalLetter });
  entries.push({ label: tr.certificateOfAppraisal });
  entries.push({ label: tr.reportSummary });
  entries.push({ label: tr.summaryOfValue });
  entries.push({ label: tr.reportDetails });
  
  // Appraisal methodology sections
  entries.push({ label: tr.conditionsHeading });
  entries.push({ label: tr.purposeHeading });
  entries.push({ label: tr.scopeHeading });
  entries.push({ label: "Factors Affecting Value" });
  entries.push({ label: tr.valueTermHeading });
  entries.push({ label: tr.limitingHeading });
  entries.push({ label: tr.approachesHeading });
  entries.push({ label: tr.valProcessHeading });
  entries.push({ label: tr.codeEthicsHeading });
  
  // Results section (varies by grouping mode)
  const groupingMode = String(reportData?.grouping_mode || "");
  const hasLots = Array.isArray(reportData?.lots) && reportData.lots.length > 0;
  
  if (groupingMode === "combined") {
    const modes: string[] = Array.isArray(reportData?.combined_modes)
      ? reportData.combined_modes
      : ["per_item", "per_photo", "single_lot"];
    
    if (modes.includes("per_item")) entries.push({ label: tr.perItemResults });
    if (modes.includes("per_photo")) entries.push({ label: tr.perPhotoResults });
    if (modes.includes("single_lot")) entries.push({ label: tr.singleLotResults });
  } else if (hasLots) {
    if (groupingMode === "catalogue") {
      entries.push({ label: tr.assetCatalogue });
    } else if (groupingMode === "per_item") {
      entries.push({ label: tr.perItemResults });
    } else {
      entries.push({ label: tr.results });
    }
  }
  
  // Supporting sections
  entries.push({ label: tr.marketOverview });
  
  // Optional sections based on content
  const hasImages = Array.isArray(reportData?.imageUrls) && reportData.imageUrls.length > 0;
  if (hasImages) {
    entries.push({ label: tr.appendix });
  }
  
  const hasCv = !!(reportData?.user_cv_url);
  if (hasCv) {
    entries.push({ label: "Appraiser CV" });
  }

  // Create table header row
  const headerRow = new TableRow({
    cantSplit: true,
    children: [
      new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({ 
                text: tr.section, 
                bold: true,
                size: 22
              })
            ],
          }),
        ],
      }),
      new TableCell({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ 
                text: tr.page.trim(), 
                bold: true,
                size: 22
              })
            ],
          }),
        ],
      }),
    ],
  });

  // Build table rows with dotted leaders
  const rows: TableRow[] = [headerRow];
  let pageNumber = 1;
  
  for (const entry of entries) {
    rows.push(
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            children: [
              new Paragraph({
                tabStops: [
                  {
                    type: TabStopType.RIGHT,
                    position: TabStopPosition.MAX,
                    leader: "dot",
                  },
                ],
                children: [
                  new TextRun({ text: entry.label, size: 22 }),
                  new TextRun({ text: "\t", size: 22 }),
                ],
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ 
                    text: pageNumber.toString(), 
                    size: 22 
                  })
                ],
              }),
            ],
          }),
        ],
      })
    );
    pageNumber++;
  }

  // Create table with proper styling
  const table = new Table({
    width: { 
      size: 100, 
      type: WidthType.PERCENTAGE 
    },
    columnWidths: [
      Math.round(9040 * 0.8), // Section name column (80%)
      Math.round(9040 * 0.2)  // Page number column (20%)
    ],
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

  // Return TOC with heading, divider, and table
  return [
    new Paragraph({
      text: tr.tableOfContents,
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: !skipPageBreak,
      spacing: { after: 120 },
    }),
    goldDivider(),
    table,
  ];
}
