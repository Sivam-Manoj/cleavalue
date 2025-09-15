import {
  AlignmentType,
  HeadingLevel,
  ImageRun,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  BorderStyle,
} from "docx";
import { fetchImageBuffer, goldDivider } from "./utils.js";

export async function buildAssetLots(
  reportData: any,
  rootImageUrls: string[],
  contentWidthTw: number
): Promise<Array<Paragraph | Table>> {
  const children: Array<Paragraph | Table> = [];
  const lots: any[] = Array.isArray(reportData?.lots) ? reportData.lots : [];

  if (!lots.length) return children;

  // Section header
  children.push(
    new Paragraph({
      text: "Lots",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 160 },
    })
  );
  children.push(goldDivider());

  const imgCellMargins = { top: 60, bottom: 60, left: 60, right: 60 };
  const gridCols = 4;
  const cellW = Math.round(contentWidthTw / gridCols);

  for (const lot of lots) {
    // Lot title
    const titlePieces: TextRun[] = [];
    titlePieces.push(new TextRun({ text: `Lot ${String(lot?.lot_id || "").trim()}`, bold: true }));
    if (lot?.title) {
      titlePieces.push(new TextRun({ text: " — ", color: "6B7280" }));
      titlePieces.push(new TextRun({ text: String(lot.title), bold: true }));
    }
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: titlePieces, spacing: { after: 80 } }));

    // Badges line
    const badges: string[] = [];
    if (lot?.condition) badges.push(`Condition: ${lot.condition}`);
    if (lot?.estimated_value) badges.push(`Est. Value: ${lot.estimated_value}`);
    if (Array.isArray(lot?.items)) badges.push(`Items: ${lot.items.length}`);
    if (badges.length) children.push(new Paragraph({ text: badges.join("  •  "), spacing: { after: 80 } }));

    // Description
    if (lot?.description) children.push(new Paragraph({ text: String(lot.description), spacing: { after: 100 } }));

    // Build image grid from image_urls -> image_indexes -> image_url
    let urls: string[] = [];
    if (Array.isArray(lot?.image_urls) && lot.image_urls.length) {
      urls = lot.image_urls.filter(Boolean);
    } else if (Array.isArray(lot?.image_indexes) && lot.image_indexes.length) {
      urls = lot.image_indexes
        .map((i: number) => (Number.isFinite(i) && i >= 0 ? rootImageUrls[i] : undefined))
        .filter(Boolean) as string[];
    } else if (typeof lot?.image_url === "string" && lot.image_url) {
      urls = [lot.image_url];
    }

    if (urls.length) {
      const bufs = await Promise.all(urls.map((u) => fetchImageBuffer(u)));
      const valid: (Buffer | null)[] = bufs;
      const rows: TableRow[] = [];
      for (let i = 0; i < valid.length; i += gridCols) {
        const slice = valid.slice(i, i + gridCols);
        rows.push(
          new TableRow({
            cantSplit: true,
            children: Array.from({ length: gridCols }, (_, col) => {
              const b = slice[col];
              return new TableCell({
                width: { size: cellW, type: WidthType.DXA },
                margins: imgCellMargins,
                children: b
                  ? [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new ImageRun({ data: b as any, transformation: { width: 160, height: 120 } } as any)],
                      }),
                    ]
                  : [new Paragraph({ text: "" })],
              });
            }),
          })
        );
      }

      children.push(
        new Table({
          width: { size: contentWidthTw, type: WidthType.DXA },
          layout: TableLayoutType.FIXED,
          columnWidths: Array.from({ length: gridCols }).map(() => cellW),
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
          },
          rows,
        })
      );
    }

    // Spacing between lots
    children.push(new Paragraph({ text: "", spacing: { before: 40, after: 120 } }));
  }

  return children;
}
