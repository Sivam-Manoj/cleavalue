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
import { getLang, t } from "./i18n.js";

export function buildTOC(reportData: any): Array<Paragraph | Table> {
  const lang = getLang(reportData);
  const tr = t(lang);
  const entries: { label: string }[] = [];
  // Order should mirror sections in catalogueDocxBuilder
  entries.push({ label: tr.transmittalLetter });
  entries.push({ label: tr.certificateOfAppraisal });
  entries.push({ label: tr.reportSummary });
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
    else entries.push({ label: tr.lotsWord });
  }
  entries.push({ label: tr.marketOverview });
  entries.push({ label: tr.references });
  const hasImages =
    Array.isArray(reportData?.imageUrls) && reportData.imageUrls.length > 0;
  if (hasImages) entries.push({ label: tr.appendixPhotos });

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
      text: tr.tableOfContents,
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 120 },
    }),
    goldDivider(),
    table,
  ];
}
