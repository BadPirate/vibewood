"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const openai_1 = __importDefault(require("openai"));
dotenv_1.default.config();
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required.");
}
const client = new openai_1.default({ apiKey });
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
const defaultModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
const publicDir = path_1.default.resolve(__dirname, "../public");
const generatedDir = path_1.default.join(publicDir, "generated");
app.use(express_1.default.json({ limit: "1mb" }));
app.use(express_1.default.static(publicDir));
const ensureGeneratedDir = async () => {
    await fs_1.promises.mkdir(generatedDir, { recursive: true });
};
const extractRelativePage = (input) => {
    if (!input || input.trim() === "") {
        return "playground.html";
    }
    let candidate = input.trim();
    try {
        // If it's a full URL, extract the pathname.
        const parsedUrl = new URL(candidate, "http://dummy-host");
        candidate = parsedUrl.pathname;
    }
    catch {
        // ignore, treat as path
    }
    candidate = candidate.split("?")[0].split("#")[0];
    candidate = candidate.replace(/^\/+/, "");
    const normalized = path_1.default.normalize(candidate);
    if (normalized.startsWith("..") || path_1.default.isAbsolute(normalized)) {
        throw new Error("Invalid page path");
    }
    return normalized === "" ? "playground.html" : normalized;
};
const readHtmlFile = async (relativePath) => {
    const fullPath = path_1.default.join(publicDir, relativePath);
    try {
        const html = await fs_1.promises.readFile(fullPath, "utf-8");
        return html;
    }
    catch {
        return "";
    }
};
const writeGeneratedHtml = async (htmlContent) => {
    await ensureGeneratedDir();
    const filename = `generated/page-${Date.now()}.html`;
    const fullPath = path_1.default.join(publicDir, filename);
    await fs_1.promises.writeFile(fullPath, htmlContent, "utf-8");
    return filename;
};
app.post("/api/create", async (req, res) => {
    var _a;
    const { prompt, currentPage } = req.body;
    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
        return res.status(400).json({ error: "Prompt is required." });
    }
    let currentPagePath = null;
    try {
        if (typeof currentPage === "string" && currentPage.trim() !== "") {
            currentPagePath = extractRelativePage(currentPage);
        }
    }
    catch (error) {
        return res.status(400).json({ error: "Invalid current page provided." });
    }
    try {
        const isGeneratedPage = !!currentPagePath && currentPagePath.startsWith("generated/");
        const currentHtml = isGeneratedPage && currentPagePath ? await readHtmlFile(currentPagePath) : "";
        const documentLabel = isGeneratedPage && currentPagePath ? currentPagePath : "new-document.html";
        const systemPrompt = "You are VibeForge, an autonomous web development agent with access to web search. " +
            "When given a current HTML document and a request, research as needed, then rewrite the document. " +
            "Think like a Cursor-style coding assistant: plan the changes, apply them precisely, and return the finished file. " +
            "Your response MUST be a single self-contained HTML document starting with <!DOCTYPE html>. " +
            "Do not include Markdown, backticks, or commentary—only the HTML.";
        const userPrompt = `Current document (${documentLabel}):\n` +
            "--------------------\n" +
            (currentHtml || "(empty)") +
            "\n--------------------\n\n" +
            `User request: ${prompt}\n\n` +
            "Return only the updated HTML document.";
        const response = await client.responses.create({
            model: defaultModel,
            input: [
                {
                    role: "system",
                    content: [
                        {
                            type: "input_text",
                            text: systemPrompt,
                        },
                    ],
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: userPrompt,
                        },
                    ],
                },
            ],
            tools: [
                {
                    type: "web_search_preview",
                },
                {
                    type: "image_generation",
                },
            ],
            tool_choice: "auto",
        });
        const outputHtml = (_a = response.output_text) === null || _a === void 0 ? void 0 : _a.trim();
        if (!outputHtml) {
            return res.status(502).json({ error: "No HTML content returned from model." });
        }
        if (!/^<!DOCTYPE html>/i.test(outputHtml) || !outputHtml.toLowerCase().includes("<html")) {
            return res.status(502).json({ error: "Model response was not a complete HTML document." });
        }
        if (outputHtml.includes("```")) {
            return res.status(502).json({ error: "Model response contained Markdown fences, which are not allowed." });
        }
        const filename = await writeGeneratedHtml(outputHtml);
        return res.json({ filename });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Failed to process create request:", message);
        return res.status(500).json({ error: "Failed to generate updated HTML." });
    }
});
app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});
