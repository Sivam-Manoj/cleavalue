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
} from "docx";
import { goldDivider } from "./utils.js";

export function buildTOC(reportData: any): Array<Paragraph | Table> {
  const entries: { label: string }[] = [];
  // Order should mirror sections in catalogueDocxBuilder
  entries.push({ label: "Transmittal Letter" });
  entries.push({ label: "Certificate of Appraisal" });
  entries.push({ label: "Report Summary" });
  const gm = String(reportData?.grouping_mode || "");
  if (gm === "combined") {
    const modes: string[] = Array.isArray(reportData?.combined_modes)
      ? reportData.combined_modes
      : ["per_item", "per_photo", "single_lot"];
    if (modes.includes("per_item")) entries.push({ label: "Per Item Results" });
    if (modes.includes("per_photo")) entries.push({ label: "Per Lot Results" });
    if (modes.includes("single_lot"))
      entries.push({ label: "Single Lot Results" });
  } else if (Array.isArray(reportData?.lots) && reportData.lots.length) {
    if (gm === "catalogue") entries.push({ label: "Catalogue" });
    else if (gm === "per_item") entries.push({ label: "Analyzed Items" });
    else entries.push({ label: "Lots" });
  }
  entries.push({ label: "Market Overview" });
  entries.push({ label: "References" });
  const hasImages =
    Array.isArray(reportData?.imageUrls) && reportData.imageUrls.length > 0;
  if (hasImages) entries.push({ label: "Appendix: Photo Gallery" });

  const headerRow = new TableRow({
    cantSplit: true,
    children: [
      new TableCell({
        children: [
          new Paragraph({
            children: [new TextRun({ text: "Section", bold: true })],
          }),
        ],
      }),
      new TableCell({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Page", bold: true })],
          }),
        ],
      }),
    ],
  });

  const rows: TableRow[] = [headerRow];
  for (const e of entries) {
    rows.push(
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            children: [new Paragraph({ text: e.label })],
          }),
          new TableCell({
            children: [
              new Paragraph({ alignment: AlignmentType.RIGHT, text: "—" }),
            ],
          }),
        ],
      })
    );
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
      text: "Table of Contents",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 120 },
    }),
    goldDivider(),
    table,
  ];
}
