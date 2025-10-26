import { HeadingLevel, Paragraph } from "docx";
import { formatDateUS } from "./utils.js";

/**
 * Build the Certification of Inspection and Appraisal section
 * Returns a full page section starting on a new page.
 */
export function buildCertificationSection(reportData: any): Paragraph[] {
  const appraiserName =
    (reportData?.appraiser as string) ||
    (reportData?.inspector_name as string) ||
    "Certified Appraiser";
  const companyName = (String(reportData?.appraisal_company || "McDougall Auctioneers")
    .replace(/\bLtd\.?\b/gi, "")
    .trim() || "McDougall Auctioneers");
  const inspectionDate = reportData?.inspection_date
    ? formatDateUS(String(reportData.inspection_date))
    : undefined;

  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      text: "CERTIFICATION OF INSPECTION AND APPRAISAL",
      heading: HeadingLevel.HEADING_2,
      pageBreakBefore: true,
    }),
    new Paragraph({ text: "I do hereby certify that:" }),
    new Paragraph({
      text:
        "The statement of fact contained in this appraisal report, upon which the analysis, opinions and conclusions expressed herein are based, are true and accurate.",
      bullet: { level: 0 },
    }),
    new Paragraph({
      text:
        "The reported analyses, opinions and conclusions are limited only by the reported assumptions and limiting conditions and are our personal, unbiased professional analyses, opinions and conclusions.",
      bullet: { level: 0 },
    }),
    new Paragraph({
      text:
        "We have no present or prospective interest in the subject property or assets which are the subject of this report, and we have no personal interest or bias with respect to the parties involved.",
      bullet: { level: 0 },
    }),
    new Paragraph({
      text: `${appraiserName} of ${companyName} has successfully completed the personal property appraiser certification program with the Certified Personal Property Appraisers’ Group of Canada, and is a member in good standing. This report was prepared in accordance with the standards and practices of the Certified Personal Property Appraisers Group, which has review authority of this report.`,
      bullet: { level: 0 },
    }),
    new Paragraph({
      text:
        "Our engagement was not contingent upon developing or reporting predetermined results.",
      bullet: { level: 0 },
    }),
    new Paragraph({
      text:
        "Our compensation was not contingent upon the reporting of a predetermined value, the amount of the value opinion, the attainment of a stipulated result, or the occurrence of a subsequent event directly related to the intended use of this appraisal.",
      bullet: { level: 0 },
    }),
    new Paragraph({
      text: `An inspection of the assets included in this report was made by ${appraiserName}${inspectionDate ? ` on ${inspectionDate}` : ""}.`,
      bullet: { level: 0 },
    }),
    new Paragraph({
      text:
        `No one other than the undersigned and any listed personnel provided significant appraisal assistance in the preparation, analysis, opinions, and conclusions concerning the property that is set forth in this appraisal report. ${appraiserName} conducted the site visits and research. ${appraiserName} examined and compared asking prices on the assets appraised.`,
      bullet: { level: 0 },
    }),
    new Paragraph({ text: "Sincerely,", spacing: { before: 240 } }),
    new Paragraph({ text: `${appraiserName}, CPPA` }),
    new Paragraph({ text: "Certified Appraiser" }),
    new Paragraph({ text: companyName })
  );

  return children;
}
