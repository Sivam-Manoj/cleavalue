import htmlToDocx from "html-to-docx";
import handlebars from "handlebars";
import fs from "fs/promises";
import path from "path";
import { generateCatalogueDocx } from "./docx/catalogueDocxBuilder.js";

// Helpers
handlebars.registerHelper("formatDate", function (dateString) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});

export async function generateAssetDocxFromReport(reportData: any): Promise<Buffer> {
  try {
    // Use high-fidelity DOCX builder for catalogue mode
    if (reportData?.grouping_mode === "catalogue") {
      return await generateCatalogueDocx(reportData);
    }
    const templatePath = path.resolve(
      process.cwd(),
      reportData?.grouping_mode === "per_item"
        ? "src/templates/asset_per_item.html"
        : "src/templates/asset.html"
    );
    const htmlTemplate = await fs.readFile(templatePath, "utf-8");

    const logoPath = path.resolve(process.cwd(), "public/logo.jpg");
    const logoImage = await fs.readFile(logoPath);
    const logoBase64 = logoImage.toString("base64");
    const logoUrl = `data:image/jpeg;base64,${logoBase64}`;

    const template = handlebars.compile(htmlTemplate);

    const sanitizedData = JSON.parse(JSON.stringify(reportData));

    const dataForDocx = {
      logo_url: logoUrl,
      ...sanitizedData,
    };

    const finalHtml = template(dataForDocx);

    // Prepare simple header/footer HTML and document options
    const headerHtml = "<p></p>"; // keep header minimal for compatibility
    const footerHtml = "<p></p>"; // footer content is optional; page numbers enabled via options
    const docOptions = {
      lang: "en-US",
      orientation: "portrait",
      margins: {
        top: 1440, // 1 inch
        right: 1440, // 1 inch
        bottom: 1440, // 1 inch
        left: 1440, // 1 inch
        header: 720, // 0.5 inch
        footer: 720, // 0.5 inch
        gutter: 0,
      },
      title:
        (sanitizedData?.title as string) ||
        `Asset Report - ${sanitizedData?.lots?.length || 0} ${sanitizedData?.grouping_mode || ""}`,
      creator:
        (sanitizedData?.appraiser as string) ||
        (sanitizedData?.inspector_name as string) ||
        "ClearValue",
      header: true,
      headerType: "default",
      footer: true,
      footerType: "default",
      pageNumber: true, // enable automatic page numbering in footer
      skipFirstHeaderFooter: true, // keep cover page clean
      font: "Times New Roman",
      fontSize: 22, // 11 pt
      decodeUnicode: false,
    } as any;

    // Convert HTML to DOCX with proper parameters (html, headerHTML, options, footerHTML)
    const docxOut: any = await htmlToDocx(finalHtml, headerHtml, docOptions, footerHtml);

    // Ensure we always return a Node.js Buffer (handle Buffer | ArrayBuffer | Blob | TypedArray)
    if (Buffer.isBuffer(docxOut)) {
      return docxOut as Buffer;
    }

    if (docxOut instanceof ArrayBuffer) {
      return Buffer.from(docxOut);
    }

    if (ArrayBuffer.isView(docxOut)) {
      const view = docxOut as Uint8Array; // covers DataView/TypedArray, Buffer.from handles Uint8Array
      return Buffer.from(view);
    }

    if (docxOut && typeof docxOut.arrayBuffer === "function") {
      const ab: ArrayBuffer = await docxOut.arrayBuffer();
      return Buffer.from(ab);
    }

    throw new Error("Unsupported html-to-docx output type");
  } catch (error) {
    console.error("Error generating Asset DOCX:", error);
    throw new Error("Failed to generate Asset DOCX report.");
  }
}
