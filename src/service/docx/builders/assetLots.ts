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
import { getLang, t } from "./i18n.js";

function formatMoneyStrict(input: any, ccy: string): string {
  try {
    let n: number | null = null;
    if (typeof input === "number" && Number.isFinite(input)) n = input;
    else if (typeof input === "string") {
      const cleaned = input.replace(/[^0-9.\-]/g, "");
      if (cleaned) {
        const parsed = Number(cleaned);
        if (Number.isFinite(parsed)) n = parsed;
      }
    }
    if (n === null) return String(input || "—");
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: ccy || "CAD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return String(input || "—");
  }
}

export async function buildAssetLots(
  reportData: any,
  rootImageUrls: string[],
  contentWidthTw: number,
  headingLabel: string = "Lots"
): Promise<Array<Paragraph | Table>> {
  const children: Array<Paragraph | Table> = [];
  const lots: any[] = Array.isArray(reportData?.lots) ? reportData.lots : [];
  const lang = getLang(reportData);
  const tr = t(lang);
  const heading = !headingLabel || headingLabel === "Lots" ? tr.lotsWord : headingLabel;
  const ccy = String((reportData as any)?.currency || 'CAD');

  if (!lots.length) return children;

  // Section header
  children.push(
    new Paragraph({
      text: heading,
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
    titlePieces.push(new TextRun({ text: `${tr.lotWord} ${String(lot?.lot_id || "").trim()}`, bold: true }));
    if (lot?.title) {
      titlePieces.push(new TextRun({ text: " — ", color: "6B7280" }));
      titlePieces.push(new TextRun({ text: String(lot.title), bold: true }));
    }
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: titlePieces, spacing: { after: 80 } }));

    // Badges line
    const badges: string[] = [];
    if (lot?.condition) badges.push(`${tr.condition}: ${lot.condition}`);
    if (lot?.estimated_value)
      badges.push(
        `${(tr as any).estValue ? (tr as any).estValue(ccy) : tr.estValueCad}: ${formatMoneyStrict(lot.estimated_value, ccy)}`
      );
    if (Array.isArray(lot?.items)) badges.push(`${tr.itemsWord}: ${lot.items.length}`);
    if (badges.length) children.push(new Paragraph({ text: badges.join("  •  "), spacing: { after: 80 } }));

    // Description
    if (lot?.description) children.push(new Paragraph({ text: String(lot.description), spacing: { after: 100 } }));

    // Vehicle Details (structured) if VIN decoded data exists
    const vd: any = (lot as any)?.vinDecoded;
    if (vd) {
      const parts: string[] = [];
      if (vd?.vin) parts.push(`${tr.vinLabel}: ${vd.vin}`);
      const ymmt: string[] = [];
      if (vd?.year) ymmt.push(`${tr.yearLabel}: ${String(vd.year)}`);
      if (vd?.make) ymmt.push(`${tr.makeLabel}: ${String(vd.make)}`);
      if (vd?.model) ymmt.push(`${tr.modelLabel}: ${String(vd.model)}`);
      if (vd?.trim) ymmt.push(`${tr.trimLabel}: ${String(vd.trim)}`);
      if (ymmt.length) parts.push(ymmt.join(" "));
      const eng = [vd?.engineCylinders ? `${vd.engineCylinders} ${tr.cylAbbrev}` : undefined, vd?.displacementL ? `${vd.displacementL}${tr.litersAbbrev}` : undefined]
        .filter(Boolean)
        .join(" ");
      if (eng) parts.push(`${tr.engineLabel}: ${eng}`);
      if (vd?.fuelType) parts.push(`${tr.fuelLabel}: ${vd.fuelType}`);
      if (vd?.driveType) parts.push(`${tr.driveLabel}: ${vd.driveType}`);
      if (vd?.transmission) parts.push(`${tr.transLabel}: ${vd.transmission}`);
      if (parts.length) {
        children.push(new Paragraph({ text: parts.join(" • "), spacing: { after: 80 } }));
      }
    }

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
