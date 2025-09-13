import { HeadingLevel, Paragraph, TextRun, AlignmentType } from "docx";
import { goldDivider } from "./utils.js";

export function buildTransmittalLetter(reportData: any, reportDate: string): Paragraph[] {
  const children: Paragraph[] = [];

  const clientName = String(reportData?.client_name || "XYZ Ltd");
  const exclusiveUseBy = String((reportData as any)?.exclusive_use_by || "Borger Group of Companies");
  const attentionName = String((reportData as any)?.attention || (reportData as any)?.contact_name || "LLL");

  children.push(
    new Paragraph({ text: "TRANSMITTAL LETTER", heading: HeadingLevel.HEADING_1, pageBreakBefore: true, spacing: { after: 160 } })
  );
  children.push(goldDivider());
  children.push(new Paragraph({ style: "BodyLarge", children: [new TextRun({ text: reportDate })], keepLines: true, keepNext: true, spacing: { after: 140 } }));
  children.push(new Paragraph({ style: "BodyLarge", children: [new TextRun({ text: clientName, bold: true })], keepLines: true, keepNext: true, spacing: { after: 120 } }));
  children.push(new Paragraph({ style: "BodyLarge", children: [new TextRun({ text: `Attention: ${attentionName}` })], keepLines: true, keepNext: true, spacing: { after: 80 } }));
  children.push(new Paragraph({ style: "BodyLarge", children: [new TextRun({ text: `Re: ${clientName} – Asset Appraisal` })], keepLines: true, keepNext: true, spacing: { after: 140 } }));
  children.push(new Paragraph({ style: "BodyLarge", children: [new TextRun({ text: "Dear Sirs," })], keepLines: true, keepNext: true, spacing: { after: 100 } }));
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({
          text:
            `At your request, we have prepared an appraisal of certain equipment owned by ${clientName}, a copy of which is enclosed. ` +
            `This appraisal report is intended for exclusive use by ${exclusiveUseBy} and is intended only for establishing values of the listed equipment.`,
        }),
      ],
      keepLines: true,
      keepNext: true,
      spacing: { after: 120 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({ text: "The subject assets were appraised under the premise of Orderly Liquidation Value for internal consideration." }),
      ],
      keepLines: true,
      keepNext: true,
      spacing: { after: 110 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({ text: "The cost and market approaches to value have been considered for this appraisal and have either been utilized where necessary or deemed inappropriate for the value conclusions found therein." }),
      ],
      keepLines: true,
      keepNext: true,
      spacing: { after: 110 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({ text: `After a thorough analysis of the assets and information made available to us, it is our opinion that as of the Effective Date, these assets have an Orderly Liquidation Value in Canadian Funds as shown on the certificate that we have prepared.` }),
      ],
      keepLines: true,
      keepNext: true,
      spacing: { after: 110 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({ text: "We certify that neither we nor any of our employees have any present or future interest in the appraised property. The fee charged for this appraisal was not contingent on the values reported. As such, the results stated in this letter of transmittal cannot be fully understood without the accompanying report and this letter should not be separated from the report." }),
      ],
      keepLines: true,
      keepNext: true,
      spacing: { after: 120 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: "If you require any additional information, please feel free to contact me at your convenience." })],
      keepLines: true,
      keepNext: true,
      spacing: { after: 140 },
    })
  );
  children.push(new Paragraph({ style: "BodyLarge", children: [new TextRun({ text: "Sincerely," })], keepLines: true, keepNext: true, spacing: { before: 60, after: 120 } }));
  const appraiserLine = `${reportData?.appraiser || "Certified Appraiser"}`;
  const companyLine = `${reportData?.appraisal_company || "McDougall Auctioneers Ltd."}`;
  children.push(new Paragraph({ style: "BodyLarge", children: [new TextRun({ text: appraiserLine })], keepLines: true, keepNext: true, spacing: { after: 80 } }));
  children.push(new Paragraph({ style: "BodyLarge", children: [new TextRun({ text: companyLine, bold: true })] }));

  return children;
}
