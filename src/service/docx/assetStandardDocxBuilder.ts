import fs from "fs/promises";
import path from "path";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  AlignmentType,
  TextRun,
  Table,
  TableOfContents,
  convertInchesToTwip,
  Header,
  Footer,
  PageNumber,
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
import {
  formatDateUS,
  goldDivider,
  buildKeyValueTable,
} from "./builders/utils.js";

export async function generateAssetLotsDocx(reportData: any): Promise<Buffer> {
  return generateStandardDocx(reportData, "asset");
}

export async function generatePerItemDocx(reportData: any): Promise<Buffer> {
  return generateStandardDocx(reportData, "per_item");
}

async function generateStandardDocx(
  reportData: any,
  mode: "asset" | "per_item"
): Promise<Buffer> {
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
      {
        label: "Grouping Mode",
        value: "Schedule A",
      },
      {
        label: mode === "per_item" ? "Total Items" : "Total Lots",
        value: String(lots.length),
      },
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
      {
        label: "Appraisal Purpose",
        value: String(reportData?.appraisal_purpose || ""),
      },
      { label: "Owner Name", value: String(reportData?.owner_name || "") },
      { label: "Appraiser", value: String(reportData?.appraiser || "") },
      {
        label: "Appraisal Company",
        value: String(reportData?.appraisal_company || ""),
      },
      { label: "Industry", value: String(reportData?.industry || "") },
      {
        label: "Inspection Date",
        value: formatDateUS(reportData?.inspection_date) || "",
      },
    ])
  );

  // Results section (lots grid or per-item table)
  if (mode === "per_item") {
    children.push(
      ...(await buildPerItemTable(reportData, rootImageUrls, contentWidthTw))
    );
  } else {
    children.push(
      ...(await buildAssetLots(reportData, rootImageUrls, contentWidthTw))
    );
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
      `Asset Report - ${lots.length} ${mode === "per_item" ? "Items" : "Lots"}`,
    features: { updateFields: true },
    styles: {
      default: {
        document: {
          run: {
            font: "Calibri",
            size: 26, // ~13pt base body size
            color: "111827", // gray-900
          },
          paragraph: {
            spacing: { line: 276, before: 0, after: 80 }, // slightly tighter
          },
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
          run: { size: 44, bold: true, color: "111827" }, // ~22pt
          paragraph: { spacing: { before: 180, after: 100 } },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 36, bold: true, color: "111827" }, // ~18pt
          paragraph: { spacing: { before: 140, after: 80 } },
        },
        {
          id: "Title",
          name: "Title",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 52, bold: true, color: "111827" }, // ~26pt
          paragraph: {
            spacing: { before: 160, after: 120 },
            alignment: AlignmentType.CENTER,
          },
        },
        {
          id: "BodyLarge",
          name: "Body Large",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 26, color: "111827" },
          paragraph: {
            spacing: { line: 276, before: 0, after: 80 },
          },
        },
      ],
    },
    sections: [
      // Cover (no header/footer)
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        headers: { default: new Header({ children: [] }) },
        footers: { default: new Footer({ children: [] }) },
        children: [
          buildCover(reportData, logoBuffer, contentWidthTw, "Asset Report"),
        ],
      },
      // Table of Contents (no header/footer)
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        headers: { default: new Header({ children: [] }) },
        footers: { default: new Footer({ children: [] }) },
        children: buildTOC({ ...reportData, grouping_mode: mode }),
      },
      // Transmittal Letter (no header/footer)
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        headers: { default: new Header({ children: [] }) },
        footers: { default: new Footer({ children: [] }) },
        children: buildTransmittalLetter(reportData, reportDate),
      },
      // Certificate of Appraisal (no header/footer)
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        headers: { default: new Header({ children: [] }) },
        footers: { default: new Footer({ children: [] }) },
        children: buildCertificateOfAppraisal(
          reportData,
          contentWidthTw,
          reportDate
        ) as any,
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
        headers: {
          default: new Header({ children: [headerTable] }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Page " }),
                  PageNumber.CURRENT as any,
                ],
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
