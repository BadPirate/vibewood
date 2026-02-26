import dotenv from "dotenv";
import express, { Request, Response } from "express";
import { promises as fs } from "fs";
import path from "path";
import OpenAI from "openai";

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY environment variable is required.");
}

const client = new OpenAI({ apiKey });

const app = express();
const port = process.env.PORT || 3000;
const publicDir = path.resolve(__dirname, "../public");
const generatedDir = path.join(publicDir, "generated");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(publicDir));

interface CreateRequestBody {
  prompt?: string;
  currentPage?: string;
}

const ensureGeneratedDir = async () => {
  await fs.mkdir(generatedDir, { recursive: true });
};

const extractRelativePage = (input?: string): string => {
  if (!input || input.trim() === "") {
    return "playground.html";
  }

  let candidate = input.trim();

  try {
    // If it's a full URL, extract the pathname.
    const parsedUrl = new URL(candidate, "http://dummy-host");
    candidate = parsedUrl.pathname;
  } catch {
    // ignore, treat as path
  }

  candidate = candidate.split("?")[0].split("#")[0];
  candidate = candidate.replace(/^\/+/, "");

  const normalized = path.normalize(candidate);

  if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
    throw new Error("Invalid page path");
  }

  return normalized === "" ? "playground.html" : normalized;
};

const readHtmlFile = async (relativePath: string): Promise<string> => {
  const fullPath = path.join(publicDir, relativePath);

  try {
    const html = await fs.readFile(fullPath, "utf-8");
    return html;
  } catch {
    return "";
  }
};

const writeGeneratedHtml = async (htmlContent: string): Promise<string> => {
  await ensureGeneratedDir();
  const filename = `generated/page-${Date.now()}.html`;
  const fullPath = path.join(publicDir, filename);
  await fs.writeFile(fullPath, htmlContent, "utf-8");
  return filename;
};

app.post("/api/create", async (req: Request<unknown, unknown, CreateRequestBody>, res: Response) => {
  const { prompt, currentPage } = req.body;

  if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
    return res.status(400).json({ error: "Prompt is required." });
  }

  let currentPagePath: string;

  try {
    currentPagePath = extractRelativePage(currentPage);
  } catch (error) {
    return res.status(400).json({ error: "Invalid current page provided." });
  }

  try {
    const currentHtml = await readHtmlFile(currentPagePath);

    const systemPrompt =
      "You update HTML documents in response to high-level requests. " +
      "Return a complete, valid HTML document tailored to the user's request. " +
      "Preserve existing helpful structure when appropriate.";

    const requestInput =
      `${systemPrompt}\n\n` +
      `Current document (${currentPagePath}):\n` +
      "--------------------\n" +
      (currentHtml || "(empty)") +
      "\n--------------------\n\n" +
      `User request: ${prompt}\n\n` +
      "Return only the updated HTML document.";

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: requestInput,
    });

    const outputHtml = response.output_text?.trim();

    if (!outputHtml) {
      return res.status(502).json({ error: "No HTML content returned from model." });
    }

    const filename = await writeGeneratedHtml(outputHtml);

    return res.json({ filename });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to process create request:", message);
    return res.status(500).json({ error: "Failed to generate updated HTML." });
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
