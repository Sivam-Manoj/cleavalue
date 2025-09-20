import axios from "axios";
import {
  Paragraph,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  TextRun,
} from "docx";

export function formatDateUS(dateString?: string): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatMonthYear(dateString?: string): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export async function dataUrlToBuffer(dataUrl: string): Promise<Buffer> {
  const m = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!m) throw new Error("Invalid data URL");
  return Buffer.from(m[2], "base64");
}

export async function fetchImageBuffer(url?: string | null): Promise<Buffer | null> {
  try {
    if (!url) return null;
    if (url.startsWith("data:")) return await dataUrlToBuffer(url);
    const maxAttempts = 3;
    let lastErr: any = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const resp = await axios.get<ArrayBuffer>(url, {
          responseType: "arraybuffer",
          timeout: 15000,
          headers: { Accept: "image/*" },
        });
        return Buffer.from(resp.data);
      } catch (e) {
        lastErr = e;
        // Backoff before next retry
        const delayMs = attempt === 1 ? 250 : attempt === 2 ? 750 : 0;
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    console.warn("fetchImageBuffer: failed after retries", lastErr);
    return null;
  } catch {
    return null;
  }
}

export function goldDivider(): Paragraph {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 16, color: "E11D48" } },
    spacing: { before: 80, after: 100 },
  });
}

export function buildKeyValueTable(
  rows: Array<{ label: string; value?: string }>
): Table {
  return new Table({
    width: { size: 9360, type: WidthType.DXA }, // ~6.5"
    columnWidths: [
      Math.round(9360 * 0.32),
      Math.round(9360 * 0.68),
    ],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
    },
    rows: rows.map(
      (r) =>
        new TableRow({
          children: [
            new TableCell({
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              shading: { type: ShadingType.CLEAR, fill: "F9FAFB", color: "auto" },
              children: [new Paragraph({ children: [new TextRun({ text: r.label, bold: true })] })],
            }),
            new TableCell({
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [new Paragraph(r.value && r.value.trim() ? r.value : "—")],
            }),
          ],
        })
    ),
  });
}
