import {
  AlignmentType,
  BorderStyle,
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
} from "docx";
import { fetchImageBuffer } from "./utils.js";
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

export async function buildPerItemTable(
  reportData: any,
  rootImageUrls: string[],
  contentWidthTw: number,
  headingLabel: string = "Analyzed Items"
): Promise<Array<Paragraph | Table>> {
  const children: Array<Paragraph | Table> = [];
  const items: any[] = Array.isArray(reportData?.lots) ? reportData.lots : [];
  const lang = getLang(reportData);
  const tr = t(lang);
  const heading =
    !headingLabel || headingLabel === "Analyzed Items"
      ? tr.perItemResults
      : headingLabel;
  const ccy = String((reportData as any)?.currency || "CAD");

  if (items.length) {
    children.push(
      new Paragraph({
        text: heading,
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        spacing: { after: 160 },
      })
    );
  }

  const w = {
    lot: Math.round(contentWidthTw * 0.10),
    title: Math.round(contentWidthTw * 0.17),
    sn: Math.round(contentWidthTw * 0.13),
    desc: Math.round(contentWidthTw * 0.16),
    details: Math.round(contentWidthTw * 0.12),
    value: Math.round(contentWidthTw * 0.14),
    image: Math.round(contentWidthTw * 0.24),
  };
  const imgPx = Math.max(112, Math.floor((w.image / 1440) * 96));
  const imgPxH = Math.floor((imgPx * 3) / 4);
  const cellMargins = { top: 80, bottom: 80, left: 60, right: 60 };

  const header = new TableRow({
    cantSplit: true,
    tableHeader: true,
    children: [
      new TableCell({
        width: { size: w.lot, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: "clear" as any, fill: "E5E7EB", color: "auto" },
        children: [
          new Paragraph({
            style: "TableSmall",
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: tr.lotId, bold: true })],
          }),
        ],
      }),
      new TableCell({
        width: { size: w.title, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: "clear" as any, fill: "E5E7EB", color: "auto" },
        children: [
          new Paragraph({
            style: "TableSmall",
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: tr.title, bold: true })],
          }),
        ],
      }),
      new TableCell({
        width: { size: w.sn, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: "clear" as any, fill: "E5E7EB", color: "auto" },
        children: [
          new Paragraph({
            style: "TableSmall",
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: tr.serialNoLabel, bold: true })],
          }),
        ],
      }),
      new TableCell({
        width: { size: w.desc, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: "clear" as any, fill: "E5E7EB", color: "auto" },
        children: [
          new Paragraph({
            style: "TableSmall",
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: tr.description, bold: true })],
          }),
        ],
      }),
      new TableCell({
        width: { size: w.details, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: "clear" as any, fill: "E5E7EB", color: "auto" },
        children: [
          new Paragraph({
            style: "TableSmall",
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: tr.detailsCol, bold: true })],
          }),
        ],
      }),
      new TableCell({
        width: { size: w.value, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: "clear" as any, fill: "E5E7EB", color: "auto" },
        children: [
          new Paragraph({
            style: "TableSmall",
            alignment: AlignmentType.CENTER,
            keepLines: true,
            children: [
              new TextRun({
                text: (
                  ((tr as any).estValue
                    ? (tr as any).estValue(ccy)
                    : tr.estValueCad) as string
                ).replace(/ /g, "\u00A0"),
                bold: true,
              }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: w.image, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        shading: { type: "clear" as any, fill: "E5E7EB", color: "auto" },
        children: [
          new Paragraph({
            style: "TableSmall",
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: tr.image, bold: true })],
          }),
        ],
      }),
    ],
  });

  const bodyRows: TableRow[] = [];
  for (const it of items) {
    // Resolve image preferring primary from image_urls[0], then explicit image_url, then indexes
    let imgUrl: string | undefined;
    if (Array.isArray(it?.image_urls) && typeof it.image_urls[0] === "string") {
      imgUrl = it.image_urls[0];
    } else if (typeof it?.image_url === "string" && it.image_url) {
      imgUrl = it.image_url;
    } else if (
      typeof it?.image_local_index === "number" &&
      rootImageUrls?.[it.image_local_index]
    ) {
      imgUrl = rootImageUrls[it.image_local_index];
    } else if (
      typeof it?.image_index === "number" &&
      rootImageUrls?.[it.image_index]
    ) {
      imgUrl = rootImageUrls[it.image_index];
    }
    if (process.env.DEBUG_PER_ITEM === "1") {
      try {
        console.log("[PerItemDebug][docx:perItemTable:row]", {
          lot_id: it?.lot_id,
          title: typeof it?.title === "string" ? it.title : undefined,
          chosenUrl: imgUrl,
          image_url: typeof it?.image_url === "string" ? it.image_url : undefined,
          image_urls: Array.isArray(it?.image_urls) ? it.image_urls : undefined,
          image_index: typeof it?.image_index === "number" ? it.image_index : undefined,
          image_indexes: Array.isArray(it?.image_indexes) ? it.image_indexes : undefined,
        });
      } catch {}
    }
    const imgBuf = await fetchImageBuffer(imgUrl);
    const zebra = bodyRows.length % 2 === 1;

    bodyRows.push(
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: w.lot, type: WidthType.DXA },
            margins: cellMargins,
            verticalAlign: VerticalAlign.CENTER,
            shading: zebra
              ? ({ type: "clear", fill: "FAFAFA", color: "auto" } as any)
              : undefined,
            children: [
              new Paragraph({
                style: "TableSmall",
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: String(it?.lot_id || "—") })],
              }),
            ],
          }),
          new TableCell({
            width: { size: w.title, type: WidthType.DXA },
            margins: cellMargins,
            verticalAlign: VerticalAlign.CENTER,
            shading: zebra
              ? ({ type: "clear", fill: "FAFAFA", color: "auto" } as any)
              : undefined,
            children: [
              new Paragraph({
                style: "TableSmall",
                children: [
                  new TextRun({ text: String(it?.title || "—"), bold: true }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: w.sn, type: WidthType.DXA },
            margins: cellMargins,
            verticalAlign: VerticalAlign.CENTER,
            shading: zebra
              ? ({ type: "clear", fill: "FAFAFA", color: "auto" } as any)
              : undefined,
            children: (() => {
              const out: Paragraph[] = [];
              const serialText = String(it?.serial_no_or_label || "—");
              out.push(
                new Paragraph({ style: "TableSmall", text: serialText })
              );
              const vd: any = (it as any)?.vinDecoded;
              if (vd) {
                const parts: string[] = [];
                if (vd?.vin) parts.push(`${tr.vinLabel}: ${vd.vin}`);
                if (vd?.year) parts.push(`${tr.yearLabel}: ${vd.year}`);
                if (vd?.make) parts.push(`${tr.makeLabel}: ${vd.make}`);
                if (vd?.model) parts.push(`${tr.modelLabel}: ${vd.model}`);
                if (vd?.trim) parts.push(`${tr.trimLabel}: ${vd.trim}`);
                const eng = [
                  vd?.engineCylinders
                    ? `${vd.engineCylinders} ${tr.cylAbbrev}`
                    : undefined,
                  vd?.displacementL
                    ? `${vd.displacementL}${tr.litersAbbrev}`
                    : undefined,
                ]
                  .filter(Boolean)
                  .join(" ");
                if (eng) parts.push(`${tr.engineLabel}: ${eng}`);
                if (vd?.fuelType) parts.push(`${tr.fuelLabel}: ${vd.fuelType}`);
                if (vd?.driveType)
                  parts.push(`${tr.driveLabel}: ${vd.driveType}`);
                if (vd?.transmission)
                  parts.push(`${tr.transLabel}: ${vd.transmission}`);
                if (parts.length) {
                  out.push(
                    new Paragraph({
                      style: "TableSmall",
                      children: [
                        new TextRun({
                          text: parts.join(" • "),
                          color: "374151",
                        }),
                      ],
                    })
                  );
                }
              }
              return out;
            })(),
          }),
          new TableCell({
            width: { size: w.desc, type: WidthType.DXA },
            margins: cellMargins,
            verticalAlign: VerticalAlign.CENTER,
            shading: zebra
              ? ({ type: "clear", fill: "FAFAFA", color: "auto" } as any)
              : undefined,
            children: [
              new Paragraph({
                style: "TableSmall",
                text: String(it?.description || "—"),
              }),
            ],
          }),
          new TableCell({
            width: { size: w.details, type: WidthType.DXA },
            margins: cellMargins,
            verticalAlign: VerticalAlign.CENTER,
            shading: zebra
              ? ({ type: "clear", fill: "FAFAFA", color: "auto" } as any)
              : undefined,
            children: [
              new Paragraph({
                style: "TableSmall",
                text: String((it?.details ?? it?.condition) || "—"),
              }),
            ],
          }),
          new TableCell({
            width: { size: w.value, type: WidthType.DXA },
            margins: cellMargins,
            verticalAlign: VerticalAlign.CENTER,
            shading: zebra
              ? ({ type: "clear", fill: "FAFAFA", color: "auto" } as any)
              : undefined,
            children: [
              new Paragraph({
                style: "TableSmall",
                alignment: AlignmentType.RIGHT,
                keepLines: true,
                text: formatMoneyStrict(
                  (it as any)?.estimated_value,
                  ccy
                ).replace(/ /g, "\u00A0"),
              }),
            ],
          }),
          new TableCell({
            width: { size: w.image, type: WidthType.DXA },
            margins: cellMargins,
            verticalAlign: VerticalAlign.CENTER,
            shading: zebra
              ? ({ type: "clear", fill: "FAFAFA", color: "auto" } as any)
              : undefined,
            children: imgBuf
              ? [
                  new Paragraph({
                    style: "TableSmall",
                    alignment: AlignmentType.CENTER,
                    children: [
                      new ImageRun({
                        data: imgBuf as any,
                        transformation: { width: imgPx, height: imgPxH },
                      } as any),
                    ],
                  }),
                ]
              : [
                  new Paragraph({
                    style: "TableSmall",
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: tr.noImage,
                        italics: true,
                        color: "6B7280",
                      }),
                    ],
                  }),
                ],
          }),
        ],
      })
    );
  }

  children.push(
    new Table({
      width: { size: contentWidthTw, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      alignment: AlignmentType.LEFT,
      columnWidths: [w.lot, w.title, w.sn, w.desc, w.details, w.value, w.image],
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
        insideHorizontal: {
          style: BorderStyle.SINGLE,
          size: 1,
          color: "F3F4F6",
        },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "F3F4F6" },
      },
      rows: [header, ...bodyRows],
    })
  );

  return children;
}
