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
import { buildPerItemTable } from "./builders/perItemTable.js";
import { buildPerPhotoTable } from "./builders/perPhotoTable.js";
import { buildAssetLots } from "./builders/assetLots.js";
import {
  formatDateUS,
  goldDivider,
  buildKeyValueTable,
} from "./builders/utils.js";

export async function generateCombinedDocx(reportData: any): Promise<Buffer> {
  const perItemLots: any[] = Array.isArray(reportData?.combined?.per_item)
    ? reportData.combined.per_item
    : Array.isArray(reportData?.lots)
    ? reportData.lots
    : [];
  const perPhotoLots: any[] = Array.isArray(reportData?.combined?.per_photo)
    ? reportData.combined.per_photo
    : [];
  const singleLotLots: any[] = Array.isArray(reportData?.combined?.single_lot)
    ? reportData.combined.single_lot
    : perItemLots;

  const rootImageUrls: string[] = Array.isArray(reportData?.imageUrls)
    ? reportData.imageUrls
    : [];
  const modes: string[] = Array.isArray(reportData?.combined_modes)
    ? reportData.combined_modes
    : ["per_item", "per_photo", "single_lot"];
  const contentWidthTw = convertInchesToTwip(6.5);

  // Load logo from public
  let logoBuffer: Buffer | null = null;
  try {
    const logoPath = path.resolve(process.cwd(), "public/logo.jpg");
    logoBuffer = await fs.readFile(logoPath);
  } catch {
    logoBuffer = null;
  }

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
        label: "Mode",
        value:
          "Combined (" +
          [
            modes.includes("single_lot") ? "Single Lot" : null,
            modes.includes("per_item") ? "Per Item" : null,
            modes.includes("per_photo") ? "Per Photo" : null,
          ]
            .filter(Boolean)
            .join(" + ") +
          ")",
      },
      { label: "Per Item Rows", value: String(perItemLots.length) },
      { label: "Per Photo Rows", value: String(perPhotoLots.length) },
      { label: "Single Lot Rows", value: String(singleLotLots.length) },
      {
        label: "Total Images",
        value: String(rootImageUrls.length),
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
      { label: "Effective Date", value: formatDateUS(reportData?.effective_date) || reportDate || "" },
      { label: "Appraisal Purpose", value: String(reportData?.appraisal_purpose || "") },
      { label: "Owner Name", value: String(reportData?.owner_name || "") },
      { label: "Appraiser", value: String(reportData?.appraiser || "") },
      { label: "Appraisal Company", value: String(reportData?.appraisal_company || "") },
      { label: "Industry", value: String(reportData?.industry || "") },
      { label: "Inspection Date", value: formatDateUS(reportData?.inspection_date) || "" },
    ])
  );

  // Results sections
  const perItemReport = { ...reportData, lots: perItemLots };
  if (modes.includes("per_item")) {
    children.push(
      ...(await buildPerItemTable(
        perItemReport,
        rootImageUrls,
        contentWidthTw,
        "Per Item Results"
      ))
    );
  }

  if (modes.includes("per_photo")) {
    children.push(
      ...(await buildPerPhotoTable(
        perPhotoLots,
        rootImageUrls,
        contentWidthTw,
        "Per Photo Results"
      ))
    );
  }

  const singleLotReport = { ...reportData, lots: singleLotLots };
  if (modes.includes("single_lot")) {
    children.push(
      ...(await buildAssetLots(
        singleLotReport,
        rootImageUrls,
        contentWidthTw,
        "Single Lot Results"
      ))
    );
  }

  // Market Overview + References
  // Reuse builder that consumes reportData
  // Note: market builder already tolerates errors
  // and derives industry context from the report contents
  const { buildMarketOverview } = await import("./builders/marketOverview.js");
  children.push(...(await buildMarketOverview(reportData)));

  // Appendix
  const appendixChildren = await buildAppendixPhotoGallery(
    rootImageUrls,
    contentWidthTw
  );
  children.push(...appendixChildren);

  const doc = new Document({
    creator:
      (reportData?.appraiser as string) ||
      (reportData?.inspector_name as string) ||
      "ClearValue",
    title:
      (reportData?.title as string) || `Asset Report - Combined (${perItemLots.length} Items)`,
    features: { updateFields: true },
    styles: {
      default: {
        document: {
          run: {
            font: "Calibri",
            size: 26,
            color: "111827",
          },
          paragraph: {
            spacing: { line: 276, before: 0, after: 80 },
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
        children: [buildCover(reportData, logoBuffer, contentWidthTw, "Asset Report")],
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
        children: buildTOC({ ...reportData, grouping_mode: "combined" }),
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
