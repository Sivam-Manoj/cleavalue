import { HeadingLevel, Paragraph, TextRun, AlignmentType } from "docx";
import { goldDivider } from "./utils.js";
import { getLang, t } from "./i18n.js";

export function buildTransmittalLetter(
  reportData: any,
  reportDate: string
): Paragraph[] {
  const children: Paragraph[] = [];

  const clientName = String(reportData?.client_name || "XYZ Ltd");
  const exclusiveUseBy = String(
    (reportData as any)?.exclusive_use_by || "Borger Group of Companies"
  );
  const attentionName = String(
    (reportData as any)?.attention || (reportData as any)?.contact_name || "LLL"
  );
  const lang = getLang(reportData);
  const tr = t(lang);

  children.push(
    new Paragraph({
      text: tr.transmittalLetter,
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 160 },
    })
  );
  children.push(goldDivider());
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: reportDate })],
      keepLines: true,
      keepNext: true,
      spacing: { after: 140 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: clientName, bold: true })],
      keepLines: true,
      keepNext: true,
      spacing: { after: 120 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: `${tr.attention}: ${attentionName}` })],
      keepLines: true,
      keepNext: true,
      spacing: { after: 80 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: `${tr.rePrefix}: ${clientName} – ${tr.assetAppraisal}` })],
      keepLines: true,
      keepNext: true,
      spacing: { after: 140 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: tr.dear })],
      keepLines: true,
      keepNext: true,
      spacing: { after: 100 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({
          text: tr.exclusiveUseSentence(clientName, exclusiveUseBy),
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
        new TextRun({
          text: tr.premiseSentence,
        }),
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
        new TextRun({
          text: tr.approachesSentence,
        }),
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
        new TextRun({
          text: tr.opinionSentence,
        }),
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
        new TextRun({
          text: tr.certifySentence,
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
        new TextRun({
          text: tr.contactSentence,
        }),
      ],
      keepLines: true,
      keepNext: true,
      spacing: { after: 140 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: tr.sincerely })],
      keepLines: true,
      keepNext: true,
      spacing: { before: 60, after: 120 },
    })
  );
  const appraiserLine = `${reportData?.appraiser || "Certified Appraiser"}`;
  const companyLine = `${reportData?.appraisal_company || "McDougall Auctioneers Ltd."}`;
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: appraiserLine })],
      keepLines: true,
      keepNext: true,
      spacing: { after: 80 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: companyLine, bold: true })],
    })
  );

  return children;
}
