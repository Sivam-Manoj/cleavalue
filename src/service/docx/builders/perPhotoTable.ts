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

export async function buildPerPhotoTable(
  lots: any[],
  rootImageUrls: string[],
  contentWidthTw: number,
  headingLabel: string = "Per Photo Results"
): Promise<Array<Paragraph | Table>> {
  const children: Array<Paragraph | Table> = [];
  const rows: TableRow[] = [];
  const inferredLang = (() => {
    const map: Record<string, 'en' | 'fr' | 'es'> = {
      'Per Lot Results': 'en',
      'Per Photo Results': 'en',
      'Résultats par photo': 'fr',
      'Résultats par lot': 'fr',
      'Resultados por foto': 'es',
      'Resultados por lote': 'es',
    };
    const byLabel = map[String(headingLabel || '')];
    if (byLabel) return byLabel;
    const firstLang = (Array.isArray(lots) && lots[0] && (lots[0] as any).language) || undefined;
    return getLang({ language: firstLang });
  })();
  const tr = t(inferredLang as any);
  const heading = headingLabel || tr.perPhotoResults;

  if (lots.length) {
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
    image: Math.round(contentWidthTw * 0.12),
    title: Math.round(contentWidthTw * 0.2),
    serial: Math.round(contentWidthTw * 0.16),
    desc: Math.round(contentWidthTw * 0.32),
    value: Math.round(contentWidthTw * 0.12),
    index: Math.round(contentWidthTw * 0.08),
  };
  const cellMargins = { top: 80, bottom: 80, left: 100, right: 100 };

  const header = new TableRow({
    cantSplit: true,
    children: [
      new TableCell({
        width: { size: w.image, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: tr.image, bold: true })] })],
      }),
      new TableCell({
        width: { size: w.title, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: tr.title, bold: true })] })],
      }),
      new TableCell({
        width: { size: w.serial, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: tr.serialNoLabel, bold: true })] })],
      }),
      new TableCell({
        width: { size: w.desc, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${tr.description} / ${tr.detailsCol}`, bold: true })] })],
      }),
      new TableCell({
        width: { size: w.value, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: tr.estValueCad, bold: true })] })],
      }),
      new TableCell({
        width: { size: w.index, type: WidthType.DXA },
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "#", bold: true })] })],
      }),
    ],
  });

  rows.push(header);

  for (const rec of lots) {
    // resolve primary image
    let imgUrl: string | undefined;
    if (typeof rec?.image_index === "number" && rootImageUrls?.[rec.image_index]) {
      imgUrl = rootImageUrls[rec.image_index];
    } else if (Array.isArray(rec?.image_indexes) && rec.image_indexes.length && rootImageUrls?.[rec.image_indexes[0]]) {
      imgUrl = rootImageUrls[rec.image_indexes[0]];
    } else if (typeof rec?.image_url === "string") {
      imgUrl = rec.image_url;
    } else if (Array.isArray(rec?.image_urls) && rec.image_urls.length) {
      imgUrl = rec.image_urls[0];
    }
    const buf = await fetchImageBuffer(imgUrl);

    const desc = String(rec?.description || "");
    const details = String(rec?.details || "");

    rows.push(
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: w.image, type: WidthType.DXA },
            margins: cellMargins,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: buf
                  ? [new ImageRun({ data: buf as any, transformation: { width: 96, height: 72 } } as any)]
                  : [new TextRun({ text: tr.noImage, italics: true, color: "6B7280" })],
              }),
            ],
          }),
          new TableCell({
            width: { size: w.title, type: WidthType.DXA },
            margins: cellMargins,
            children: [new Paragraph({ children: [new TextRun({ text: String(rec?.title || "—"), bold: true })] })],
          }),
          new TableCell({
            width: { size: w.serial, type: WidthType.DXA },
            margins: cellMargins,
            children: (() => {
              const out: Paragraph[] = [];
              out.push(new Paragraph(String(rec?.serial_no_or_label || "—")));
              const vd: any = (rec as any)?.vinDecoded;
              if (vd) {
                const parts: string[] = [];
                if (vd?.vin) parts.push(`${tr.vinLabel}: ${vd.vin}`);
                if (vd?.year) parts.push(`${tr.yearLabel}: ${vd.year}`);
                if (vd?.make) parts.push(`${tr.makeLabel}: ${vd.make}`);
                if (vd?.model) parts.push(`${tr.modelLabel}: ${vd.model}`);
                if (vd?.trim) parts.push(`${tr.trimLabel}: ${vd.trim}`);
                const eng = [vd?.engineCylinders ? `${vd.engineCylinders} ${tr.cylAbbrev}` : undefined, vd?.displacementL ? `${vd.displacementL}${tr.litersAbbrev}` : undefined]
                  .filter(Boolean)
                  .join(" ");
                if (eng) parts.push(`${tr.engineLabel}: ${eng}`);
                if (vd?.fuelType) parts.push(`${tr.fuelLabel}: ${vd.fuelType}`);
                if (vd?.driveType) parts.push(`${tr.driveLabel}: ${vd.driveType}`);
                if (vd?.transmission) parts.push(`${tr.transLabel}: ${vd.transmission}`);
                if (parts.length) out.push(new Paragraph({ children: [new TextRun({ text: parts.join(" • "), color: "374151" })] }));
              }
              return out;
            })(),
          }),
          new TableCell({
            width: { size: w.desc, type: WidthType.DXA },
            margins: cellMargins,
            children: [new Paragraph((desc + (details ? `\n${details}` : "")) || "—")],
          }),
          new TableCell({
            width: { size: w.value, type: WidthType.DXA },
            margins: cellMargins,
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, text: String(rec?.estimated_value || "—") })],
          }),
          new TableCell({
            width: { size: w.index, type: WidthType.DXA },
            margins: cellMargins,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, text: String((rec?.image_index ?? (rec?.image_indexes?.[0])) ?? "—") })],
          }),
        ],
      })
    );
  }

  if (rows.length > 1) {
    children.push(
      new Table({
        width: { size: contentWidthTw, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        alignment: AlignmentType.LEFT,
        columnWidths: [w.image, w.title, w.serial, w.desc, w.value, w.index],
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

  return children;
}
