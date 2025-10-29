import { generateMixedDocx } from "./docx/mixedDocxBuilder.js";
import { createSimpleHeadingDocx } from "./docx/builders/utils.js";
import axios from "axios";
import fs from "fs/promises";
import path from "path";

/**
 * Universal DOCX generation service - uses mixedDocxBuilder for ALL modes
 * This builder has all modern enhancements:
 * - Hero image cover page
 * - Logo-only header
 * - Corporate footer with address, website, phone, appraiser
 * - Modern certificate design with highlighted value
 * - Valuation comparison table support
 * - Table of contents with all sections
 * - Multi-language support (en/fr/es)
 * - Handles all grouping modes: catalogue, combined, mixed, per_item, single_lot, per_photo
 */
export async function generateAssetDocxFromReport(
  reportData: any
): Promise<Buffer> {
  try {
    // Attempt to build templated cover page using docxtemplater first
    let coverBuf: Buffer | null = null;
    let mergerAvailable = false;
    try {
      const templatePath = path.resolve(process.cwd(), "public/coverPage.docx");
      const tplBuf = await fs.readFile(templatePath).catch(() => null as any);
      if (tplBuf && tplBuf.length > 0) {
        const modDocxtemplater: any = await (import("docxtemplater") as any).catch(
          () => null
        );
        const modPizZip: any = await (import("pizzip") as any).catch(() => null);
        if (modDocxtemplater && modPizZip) {
          try {
            const PizZip = modPizZip.default || modPizZip;
            const Docxtemplater = modDocxtemplater.default || modDocxtemplater;
            const zip = new PizZip(tplBuf);
            const doc = new Docxtemplater(zip, {
              paragraphLoop: true,
              linebreaks: true,
            });
            const preparedFor =
              (reportData as any)?.prepared_for ||
              (reportData as any)?.client_name ||
              "";
            const reportDate = (() => {
              const d =
                (reportData as any)?.effective_date ||
                (reportData as any)?.createdAt ||
                new Date();
              const dt = new Date(d);
              try {
                return dt.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                });
              } catch {
                return dt.toISOString().slice(0, 10);
              }
            })();
            const userEmail = (reportData as any)?.user_email || "";
            doc.setData({ preparedFor, reportDate, userEmail });
            doc.render();
            const out = doc.getZip().generate({ type: "nodebuffer" });
            coverBuf = Buffer.from(out);
          } catch (e) {
            console.warn("Templated cover generation failed:", e);
            coverBuf = null;
          }
        }
        // Check merger availability
        try {
          const mod: any = await (import("docx-merger") as Promise<any>).catch(
            () => null
          );
          mergerAvailable = !!(mod?.default || mod);
        } catch {}
      }
    } catch {}

    // Use unified mixedDocxBuilder; skip built-in cover only if we can merge a templated one
    const baseBuffer = await generateMixedDocx({
      ...(reportData || {}),
      ...(coverBuf && mergerAvailable ? { custom_cover: true } : {}),
    });

    let withCoverBuffer: Buffer = baseBuffer;
    if (coverBuf && mergerAvailable) {
      try {
        const DocxMergerMod: any = await import("docx-merger");
        const DocxMerger = (DocxMergerMod as any)?.default || DocxMergerMod;
        const merger = new DocxMerger({}, [coverBuf, baseBuffer]);
        withCoverBuffer = await new Promise((resolve) => {
          (merger as any).save("nodebuffer", (data: Buffer) => resolve(data));
        });
      } catch (e) {
        console.warn("Cover merge failed at runtime, using base buffer.");
        withCoverBuffer = baseBuffer;
      }
    }

    // Attempt to append user's CV .docx (if available)
    const cvUrl: string | undefined =
      typeof reportData?.user_cv_url === "string" && reportData.user_cv_url
        ? String(reportData.user_cv_url)
        : undefined;
    if (!cvUrl) return withCoverBuffer;

    try {
      const resp = await axios.get<ArrayBuffer>(cvUrl, {
        responseType: "arraybuffer",
      });
      const cvBuffer = Buffer.from(resp.data as any);
      if (!cvBuffer || cvBuffer.length === 0) return withCoverBuffer;

      // Create a divider page with "Appraiser CV" heading
      const dividerBuffer = await createSimpleHeadingDocx("Appraiser CV");

      // Try dynamic import of a merger; gracefully fallback if unavailable
      try {
        const mergerModuleName = "docx-merger";
        const mod: any = await (import(mergerModuleName) as Promise<any>).catch(
          () => null
        );
        const DocxMerger = mod?.default || mod;
        if (!DocxMerger) return withCoverBuffer;

        const merger = new DocxMerger({}, [withCoverBuffer, dividerBuffer, cvBuffer]);
        const merged: Buffer = await new Promise((resolve) => {
          (merger as any).save("nodebuffer", (data: Buffer) => resolve(data));
        });
        return merged || withCoverBuffer;
      } catch (e) {
        console.warn("CV merge library not available, skipping CV append.");
        return withCoverBuffer;
      }
    } catch (err) {
      console.warn("Failed to fetch or append CV docx:", err);
      return withCoverBuffer;
    }
  } catch (error) {
    console.error("Error generating Asset DOCX:", error);
    throw new Error("Failed to generate Asset DOCX report.");
  }
}
