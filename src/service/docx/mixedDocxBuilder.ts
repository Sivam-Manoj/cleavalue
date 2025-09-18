import fs from "fs/promises";
import path from "path";
import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  PageNumber,
  Paragraph,
  Packer,
  Table,
  TableOfContents,
  TextRun,
  convertInchesToTwip,
} from "docx";
import { buildHeaderTable } from "./builders/header.js";
import { buildAppendixPhotoGallery } from "./builders/appendix.js";
import { buildCover } from "./builders/cover.js";
import { buildTOC } from "./builders/toc.js";
import { buildTransmittalLetter } from "./builders/transmittal.js";
import { buildCertificateOfAppraisal } from "./builders/certificate.js";
import { buildMarketOverview } from "./builders/marketOverview.js";
import { buildAssetLots } from "./builders/assetLots.js";
import { buildPerItemTable } from "./builders/perItemTable.js";
import { buildPerPhotoTable } from "./builders/perPhotoTable.js";
import { buildKeyValueTable, formatDateUS, goldDivider } from "./builders/utils.js";

export async function generateMixedDocx(reportData: any): Promise<Buffer> {
  const lots: any[] = Array.isArray(reportData?.lots) ? reportData.lots : [];
  const rootImageUrls: string[] = Array.isArray(reportData?.imageUrls)
    ? reportData.imageUrls
    : [];
  const contentWidthTw = convertInchesToTwip(6.5);

  // Load logo from public
  let logoBuffer: Buffer | null = null;
  try {
    const logoPath = path.resolve(process.cwd(), "public/logo.jpg");
    logoBuffer = await fs.readFile(logoPath);
  } catch {
    logoBuffer = null;
  }

  // Header table via builder
  const headerTable = buildHeaderTable(
    logoBuffer,
    contentWidthTw,
    (reportData as any)?.user_email
  );

  const children: Array<Paragraph | Table | TableOfContents> = [];
  const reportDate = formatDateUS(
    reportData?.createdAt || new Date().toISOString()
  );

  // Report Summary
  children.push(
    new Paragraph({
      text: "Report Summary",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 160 },
    })
  );
  children.push(goldDivider());
  children.push(
    buildKeyValueTable([
      { label: "Grouping Mode", value: "Mixed" },
      { label: "Total Lots", value: String(lots.length) },
      {
        label: "Total Images",
        value: String(
          Array.isArray(reportData?.imageUrls) ? reportData.imageUrls.length : 0
        ),
      },
    ])
  );

  // Optional summary text/value
  const totalAppraised =
    (reportData?.total_appraised_value as string) ||
    (reportData?.total_value as string) ||
    (reportData?.analysis?.total_value as string) ||
    undefined;
  children.push(
    new Paragraph({
      text: "Summary of Value Conclusions",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 80 },
    })
  );
  children.push(goldDivider());
  children.push(
    new Paragraph({
      style: "BodyLarge",
      text: totalAppraised
        ? `Based upon our analysis and methodology, we estimate the reported assets have a value of ${totalAppraised}.`
        : `Based upon our analysis and methodology, please refer to the detailed sections for value information.`,
      spacing: { after: 160 },
    })
  );

  // Report Details
  children.push(
    new Paragraph({
      text: "Report Details",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 120, after: 80 },
    })
  );
  children.push(goldDivider());
  children.push(
    buildKeyValueTable([
      { label: "Client Name", value: String(reportData?.client_name || "") },
      {
        label: "Effective Date",
        value: formatDateUS(reportData?.effective_date) || reportDate || "",
      },
      { label: "Appraisal Purpose", value: String(reportData?.appraisal_purpose || "") },
      { label: "Owner Name", value: String(reportData?.owner_name || "") },
      { label: "Appraiser", value: String(reportData?.appraiser || "") },
      { label: "Appraisal Company", value: String(reportData?.appraisal_company || "") },
      { label: "Industry", value: String(reportData?.industry || "") },
      { label: "Inspection Date", value: formatDateUS(reportData?.inspection_date) || "" },
    ])
  );

  // Results: table per mixed lot group, using sub-mode specific layout
  // Group lots by mixed_group_index
  const groupMap = new Map<number, any[]>();
  for (const lot of lots) {
    const gi = Number(lot?.mixed_group_index) || 0;
    if (!groupMap.has(gi)) groupMap.set(gi, []);
    groupMap.get(gi)!.push(lot);
  }
  const groupIds = Array.from(groupMap.keys()).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  const useGroupIds = groupIds.length ? groupIds : [0];

  for (const gid of useGroupIds) {
    const items = groupMap.get(gid) || lots;
    const subMode: string = String(items[0]?.sub_mode || (items[0]?.tags || []).find?.((t: string) => typeof t === "string" && t.startsWith("mode:"))?.split?.(":")?.[1] || "single_lot");
    const label = `Lot ${gid || 1} — ${subMode === "per_item" ? "Per Item" : subMode === "per_photo" ? "Per Photo" : "Single Lot"}`;

    if (subMode === "per_item") {
      const pseudo = { lots: items };
      children.push(...(await buildPerItemTable(pseudo, rootImageUrls, contentWidthTw, label)));
    } else if (subMode === "per_photo") {
      children.push(...(await buildPerPhotoTable(items, rootImageUrls, contentWidthTw, label)));
    } else {
      const pseudo = { lots: items };
      children.push(...(await buildAssetLots(pseudo, rootImageUrls, contentWidthTw, label)));
    }
  }

  // Market Overview + References
  children.push(...(await buildMarketOverview(reportData)));

  // Appendix
  const appendixChildren = await buildAppendixPhotoGallery(
    rootImageUrls,
    contentWidthTw
  );
  children.push(...appendixChildren);

  // Finalize document with sections and pack
  const doc = new Document({
    creator:
      (reportData?.appraiser as string) ||
      (reportData?.inspector_name as string) ||
      "ClearValue",
    title:
      (reportData?.title as string) ||
      `Asset Report - ${lots.length} Lots (Mixed)`,
    features: { updateFields: true },
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 26, color: "111827" },
          paragraph: { spacing: { line: 276, before: 0, after: 80 } },
        },
      },
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          basedOn: "",
          next: "Normal",
          run: { font: "Calibri", size: 26, color: "111827" },
          paragraph: { spacing: { line: 276, after: 120 } },
        },
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 44, bold: true, color: "111827" },
          paragraph: { spacing: { before: 180, after: 100 } },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 36, bold: true, color: "111827" },
          paragraph: { spacing: { before: 140, after: 80 } },
        },
        {
          id: "Title",
          name: "Title",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 52, bold: true, color: "111827" },
          paragraph: { spacing: { before: 160, after: 120 }, alignment: AlignmentType.CENTER },
        },
        {
          id: "BodyLarge",
          name: "Body Large",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 26, color: "111827" },
          paragraph: { spacing: { line: 276, before: 0, after: 80 } },
        },
      ],
    },
    sections: [
      // Cover (no header/footer)
      {
        properties: {
          page: { margin: { top: convertInchesToTwip(1), right: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1) } },
        },
        headers: { default: new Header({ children: [] }) },
        footers: { default: new Footer({ children: [] }) },
        children: [buildCover(reportData, logoBuffer, contentWidthTw, "Asset Report")],
      },
      // Table of Contents (no header/footer)
      {
        properties: {
          page: { margin: { top: convertInchesToTwip(1), right: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1) } },
        },
        headers: { default: new Header({ children: [] }) },
        footers: { default: new Footer({ children: [] }) },
        children: buildTOC({ ...reportData, grouping_mode: "mixed" }),
      },
      // Transmittal Letter (no header/footer)
      {
        properties: {
          page: { margin: { top: convertInchesToTwip(1), right: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1) } },
        },
        headers: { default: new Header({ children: [] }) },
        footers: { default: new Footer({ children: [] }) },
        children: buildTransmittalLetter(reportData, reportDate),
      },
      // Certificate of Appraisal (no header/footer)
      {
        properties: {
          page: { margin: { top: convertInchesToTwip(1), right: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1) } },
        },
        headers: { default: new Header({ children: [] }) },
        footers: { default: new Footer({ children: [] }) },
        children: buildCertificateOfAppraisal(reportData, contentWidthTw, reportDate) as any,
      },
      // Main content (with header/footer). Restart page numbers at 1.
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
            pageNumbers: { start: 1 },
          },
        },
        headers: { default: new Header({ children: [headerTable] }) },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "Page " }), PageNumber.CURRENT as any],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  return buf;
}
