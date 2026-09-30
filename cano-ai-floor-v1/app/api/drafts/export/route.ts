import { NextRequest, NextResponse } from "next/server";
import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from "docx";
import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";
import { getMatterByMondayId } from "../../../../lib/supabase/matters";
import { getLatestSpecialistState } from "../../../../lib/supabase/agents";

export const dynamic = "force-dynamic";

const INLINE_PLACEHOLDER_MAP: Record<string, string> = {
  "ATTORNEY INPUT NEEDED: CONFIRM DIVISION": "DIVISION TBD",
  "ATTORNEY INPUT NEEDED: CORRECT DISTRICT": "DISTRICT TBD",
  "ATTORNEY INPUT NEEDED: CONFIRM DISTRICT": "DISTRICT TBD",
  "ATTORNEY INPUT NEEDED: PETITIONER FULL NAME": "PETITIONER NAME TBD",
  "ATTORNEY INPUT NEEDED: PRIMARY CUSTODIAN NAME AND TITLE": "RESPONDENT TBD",
  "ATTORNEY INPUT NEEDED: CIVIL ACTION NUMBER": "CASE NO. TBD",
  "ATTORNEY INPUT NEEDED: CASE NUMBER": "CASE NO. TBD",
  "ATTORNEY INPUT NEEDED: CONFIRM A-NUMBER": "A-NUMBER TBD",
  "ATTORNEY INPUT NEEDED: CONFIRM DETENTION DATE": "DETENTION DATE TBD",
  "ATTORNEY INPUT NEEDED: CONFIRM REQUESTED RELIEF": "RELIEF TBD",
  "ATTORNEY INPUT NEEDED: VERIFICATION DATE": "DATE TBD",
};

function normalizePlaceholderKey(raw: string) {
  return String(raw || "")
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function shortPlaceholderLabel(raw: string) {
  const normalized = normalizePlaceholderKey(raw);
  const mapped = INLINE_PLACEHOLDER_MAP[normalized];
  if (mapped) return mapped;

  const cleaned = normalized
    .replace(/^ATTORNEY INPUT NEEDED:\s*/i, "")
    .replace(/^(CONFIRM|INSERT|PROVIDE|VERIFY)\s+/i, "")
    .trim();

  if (!cleaned) return "INPUT TBD";
  if (cleaned.length <= 26) return `${cleaned} TBD`;

  const firstMeaningful = cleaned
    .split(/[,;:–—-]/)[0]
    .trim()
    .slice(0, 24)
    .trim();

  return `${firstMeaningful || "INPUT"} TBD`;
}

function compactInlinePlaceholders(value: string) {
  return String(value || "")
    .replace(
      /\[ATTORNEY INPUT NEEDED:\s*([^\]]+)\]/gi,
      (_match, inner) =>
        `[${shortPlaceholderLabel(
          `ATTORNEY INPUT NEEDED: ${String(inner || "").trim()}`
        )}]`
    )
    .replace(/FOR\s+THF\.?/gi, "FOR THE");
}

function isCompactPlaceholder(value: string) {
  return /^\[[^\]]+\]$/.test(String(value || "").trim());
}


function cleanMarkdownText(value: string) {
  return String(value || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\`(.*?)\`/g, "$1")
    .trim();
}

function safeFileName(value: string) {
  const cleaned = String(value || "Cano-Draft")
    .replace(/[^a-zA-Z0-9-_ ]+/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return cleaned || "Cano-Draft";
}

function markdownLines(markdown: string) {
  return String(markdown || "")
    .replace(/\r\n/g, "\n")
    .split("\n");
}


function docxRunsForText(
  text: string,
  options: { bold?: boolean; size?: number } = {}
) {
  const cleaned = compactInlinePlaceholders(cleanMarkdownText(text));
  const parts = cleaned.split(
    /(\[[^\]]+\])/g
  );

  return parts
    .filter((part) => part.length > 0)
    .map(
      (part) =>
        new TextRun({
          text: part,
          font: "Times New Roman",
          size: options.size || 24,
          bold:
            options.bold ||
            isCompactPlaceholder(part),
          highlight: isCompactPlaceholder(part)
            ? "yellow"
            : undefined,
        })
    );
}

function isAttorneyInputLine(text: string) {
  return /\[[^\]]+\]/.test(compactInlinePlaceholders(text));
}

function buildDocxParagraphs(markdown: string) {
  const paragraphs: Paragraph[] = [];

  for (const raw of markdownLines(markdown)) {
    const line = compactInlinePlaceholders(raw.trim());

    if (!line) {
      paragraphs.push(new Paragraph({ children: [new TextRun("")] }));
      continue;
    }

    if (line.startsWith("### ")) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: docxRunsForText(line.slice(4), { bold: true, size: 24 }),
        })
      );
      continue;
    }

    if (line.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: docxRunsForText(line.slice(3), { bold: true, size: 26 }),
        })
      );
      continue;
    }

    if (line.startsWith("# ")) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: docxRunsForText(line.slice(2), { bold: true, size: 28 }),
        })
      );
      continue;
    }

    if (/^[-*] /.test(line)) {
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          children: docxRunsForText(
            line.replace(/^[-*] /, ""),
            { size: 24 }
          ),
        })
      );
      continue;
    }

    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 150, line: 360 },
        children: docxRunsForText(line, { size: 24 }),
      })
    );
  }

  return paragraphs;
}

function wrapText(
  text: string,
  font: any,
  fontSize: number,
  maxWidth: number
) {
  const words = compactInlinePlaceholders(cleanMarkdownText(text))
    .split(/\s+/)
    .filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, fontSize) <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

async function buildPdf(markdown: string, title: string) {
  const pdf = await PDFDocument.create();
  const bodyFont = await pdf.embedFont(StandardFonts.TimesRoman);
  const boldFont = await pdf.embedFont(StandardFonts.TimesRomanBold);

  const pageSize: [number, number] = [612, 792];
  const margin = 54;
  const bodySize = 11;
  const lineHeight = 16;
  let page = pdf.addPage(pageSize);
  let y = pageSize[1] - 78;

  const addPage = () => {
    page = pdf.addPage(pageSize);
    y = pageSize[1] - 70;
  };

  const ensure = (needed: number) => {
    if (y - needed < margin) addPage();
  };

  const titleText = compactInlinePlaceholders(cleanMarkdownText(title));
  const titleLines = wrapText(
    titleText,
    boldFont,
    15,
    pageSize[0] - margin * 2 - 24
  );

  ensure(titleLines.length * 21 + 28);

  for (const titleLine of titleLines) {
    const width = boldFont.widthOfTextAtSize(titleLine, 15);
    page.drawText(titleLine, {
      x: Math.max(margin, (pageSize[0] - width) / 2),
      y,
      size: 15,
      font: boldFont,
      color: rgb(0.08, 0.08, 0.08),
    });
    y -= 21;
  }

  y -= 18;

  for (const raw of markdownLines(markdown)) {
    const line = raw.trim();

    if (!line) {
      y -= 8;
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    const isBullet = /^[-*] /.test(line);
    const text = headingMatch
      ? headingMatch[2]
      : isBullet
      ? `• ${line.replace(/^[-*] /, "")}`
      : line;

    const headingLevel = headingMatch?.[1]?.length || 0;
    const font = headingLevel ? boldFont : bodyFont;
    const fontSize =
      headingLevel === 1 ? 14 :
      headingLevel === 2 ? 12.5 :
      headingLevel === 3 ? 11.5 :
      bodySize;

    const lines = wrapText(
      text,
      font,
      fontSize,
      pageSize[0] - margin * 2
    );

    ensure(lines.length * lineHeight + (headingLevel ? 10 : 4));

    const highlightAttorneyInput = isAttorneyInputLine(text);

    for (const wrapped of lines) {
      if (highlightAttorneyInput) {
        const textWidth = Math.min(
          font.widthOfTextAtSize(wrapped, fontSize) + 8,
          pageSize[0] - margin * 2
        );
        page.drawRectangle({
          x: margin - 3,
          y: y - 3,
          width: textWidth,
          height: fontSize + 7,
          color: rgb(1, 0.95, 0.58),
        });
      }

      page.drawText(wrapped, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0.08, 0.08, 0.08),
      });
      y -= headingLevel ? lineHeight + 1 : lineHeight;
    }

    y -= headingLevel ? 8 : 4;
  }

  const pages = pdf.getPages();
  pages.forEach((p, index) => {
    const footer = `Cano Law Firm - Attorney Work Product - Page ${index + 1} of ${pages.length}`;
    p.drawText(footer, {
      x: margin,
      y: 24,
      size: 8,
      font: bodyFont,
      color: rgb(0.35, 0.35, 0.35),
    });
  });

  return pdf.save();
}

export async function GET(request: NextRequest) {
  const mondayItemId =
    request.nextUrl.searchParams.get("mondayItemId") || "";
  const format =
    request.nextUrl.searchParams.get("format") === "pdf"
      ? "pdf"
      : "docx";

  if (!mondayItemId) {
    return NextResponse.json(
      { ok: false, error: "mondayItemId is required." },
      { status: 400 }
    );
  }

  try {
    const matter = await getMatterByMondayId(mondayItemId);

    if (!matter) {
      return NextResponse.json(
        { ok: false, error: "Matter not found." },
        { status: 404 }
      );
    }

    const states = await getLatestSpecialistState(matter.id);
    const drafting = states.drafting?.output?.draft;

    if (!drafting?.markdown) {
      return NextResponse.json(
        { ok: false, error: "No Scribe draft is available to export." },
        { status: 404 }
      );
    }

    const matterName =
      String(
        states.drafting?.output?.title ||
        drafting?.title ||
        mondayItemId
      ) || mondayItemId;

    const title =
      drafting?.title ||
      `Cano Law Firm Working Draft - ${matterName}`;

    const baseName = safeFileName(
      `${matterName}-${drafting?.document_type || "draft"}`
    );

    if (format === "pdf") {
      const bytes = await buildPdf(drafting.markdown, title);

      return new NextResponse(Buffer.from(bytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: "Times New Roman",
              size: 24,
            },
            paragraph: {
              spacing: { line: 360, after: 120 },
            },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 720,
                right: 720,
                bottom: 720,
                left: 720,
              },
            },
          },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 260 },
              children: [
                new TextRun({
                  text: cleanMarkdownText(title),
                  bold: true,
                  font: "Times New Roman",
                  size: 28,
                }),
              ],
            }),
            ...buildDocxParagraphs(compactInlinePlaceholders(drafting.markdown)),
          ],
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: "Cano Law Firm - Attorney Work Product - Page ",
                      font: "Times New Roman",
                      size: 18,
                    }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      font: "Times New Roman",
                      size: 18,
                    }),
                  ],
                }),
              ],
            }),
          },
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${baseName}.docx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to export draft.",
      },
      { status: 500 }
    );
  }
}
