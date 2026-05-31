import mammoth from "mammoth";

export const runtime = "nodejs";

const SUPPORTED_TYPES = new Map([
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["text/plain", "text"],
  ["text/markdown", "text"],
  ["application/json", "text"],
  ["text/csv", "text"],
]);

function extensionFor(file: File) {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

function isTextExtension(extension: string) {
  return ["txt", "md", "markdown", "json", "csv"].includes(extension);
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "No file uploaded." }, { status: 400 });
    }

    const extension = extensionFor(file);
    const fileType = SUPPORTED_TYPES.get(file.type);
    const bytes = new Uint8Array(await file.arrayBuffer());
    let text = "";

    if (fileType === "docx" || extension === "docx") {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      text = result.value;
    } else if (fileType === "text" || isTextExtension(extension)) {
      text = Buffer.from(bytes).toString("utf8");
    } else {
      return Response.json(
        { error: "Unsupported file type. Upload DOCX, TXT, MD, JSON, or CSV." },
        { status: 400 },
      );
    }

    const cleanText = text.replace(/\u0000/g, "").trim();

    if (cleanText.length < 20) {
      return Response.json(
        { error: "Could not extract enough readable text from this file." },
        { status: 422 },
      );
    }

    return Response.json({
      fileName: file.name,
      characters: cleanText.length,
      text: cleanText.slice(0, 12000),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not extract text from this file.",
      },
      { status: 500 },
    );
  }
}
