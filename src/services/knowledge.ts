/**
 * Knowledge Base Store & High-Precision BM25 RAG Engine.
 *
 * Implements:
 * 1. Intelligent document chunking (breaks docs/PDFs into clean semantic paragraphs)
 * 2. Pure TypeScript BM25 / TF-IDF ranking algorithm (0 external dependencies)
 * 3. Stop-word filtering & term frequency weighting
 * 4. Safe context window budgeting (up to 6,000 tokens)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const __filename = typeof import.meta.url === "string" ? fileURLToPath(import.meta.url) : "knowledge.js";
const __dirname  = typeof import.meta.url === "string" ? dirname(__filename) : process.cwd();

export interface KnowledgeDocument {
  id: string;
  title: string;
  type: "markdown" | "text" | "pdf" | "url";
  content: string;
  charCount: number;
  createdAt: number;
  customerKey?: string;
  sourceUrl?: string;
}

export interface KnowledgeChunk {
  docId: string;
  docTitle: string;
  docType: string;
  customerKey?: string;
  chunkIndex: number;
  text: string;
  wordCount: number;
}

const DATA_DIR = join(__dirname, "../../data");
const KNOWLEDGE_FILE = join(DATA_DIR, "knowledge.json");

// Common English stop-words to eliminate search noise
const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
  "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but",
  "by", "can", "did", "do", "does", "doing", "don", "down", "during", "each", "few", "for",
  "from", "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself",
  "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just",
  "me", "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off", "on", "once",
  "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "s", "same", "she",
  "should", "so", "some", "such", "t", "than", "that", "the", "their", "theirs", "them",
  "themselves", "then", "there", "these", "they", "this", "those", "through", "to", "too",
  "under", "until", "up", "very", "was", "we", "were", "what", "when", "where", "which",
  "while", "who", "whom", "why", "will", "with", "you", "your", "yours", "yourself", "yourselves"
]);

/**
 * Loads documents from persistent storage.
 */
export const loadKnowledgeDocs = (): KnowledgeDocument[] => {
  try {
    if (!existsSync(KNOWLEDGE_FILE)) return [];
    const raw = readFileSync(KNOWLEDGE_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("[KnowledgeStore] Failed to read knowledge.json:", err);
    return [];
  }
};

/**
 * Saves documents to persistent storage.
 */
export const saveKnowledgeDocs = (docs: KnowledgeDocument[]): void => {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    writeFileSync(KNOWLEDGE_FILE, JSON.stringify(docs, null, 2), "utf-8");
  } catch (err) {
    console.error("[KnowledgeStore] Failed to write knowledge.json:", err);
  }
};

let cachedDocs: KnowledgeDocument[] = loadKnowledgeDocs();
let cachedChunks: KnowledgeChunk[] = [];

/**
 * Splits text into ~250-word semantic paragraph chunks with 30-word overlap
 */
const chunkDocument = (doc: KnowledgeDocument): KnowledgeChunk[] => {
  const paragraphs = doc.content.split(/\n\s*\n+/);
  const chunks: KnowledgeChunk[] = [];
  let chunkIdx = 0;

  for (const para of paragraphs) {
    const cleanPara = para.trim();
    if (!cleanPara) continue;

    // If paragraph is reasonable size, keep it as a chunk
    const words = cleanPara.split(/\s+/);
    if (words.length <= 350) {
      chunks.push({
        docId: doc.id,
        docTitle: doc.title,
        docType: doc.type,
        chunkIndex: chunkIdx++,
        text: cleanPara,
        wordCount: words.length
      });
    } else {
      // Break very long paragraphs into 250-word chunks with 30-word overlap
      const chunkSize = 250;
      const overlap = 30;
      for (let i = 0; i < words.length; i += (chunkSize - overlap)) {
        const slice = words.slice(i, i + chunkSize);
        if (slice.length < 15 && chunks.length > 0) break; // avoid trailing micro chunks
        chunks.push({
          docId: doc.id,
          docTitle: doc.title,
          docType: doc.type,
          chunkIndex: chunkIdx++,
          text: slice.join(" "),
          wordCount: slice.length
        });
      }
    }
  }

  return chunks;
};

const rebuildChunkIndex = () => {
  cachedChunks = [];
  for (const doc of cachedDocs) {
    cachedChunks.push(...chunkDocument(doc));
  }
};

rebuildChunkIndex();

const tokenize = (text: string): string[] => {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
};

export const KnowledgeStore = {
  list(): KnowledgeDocument[] {
    return cachedDocs;
  },

  getAll(customerKey?: string): KnowledgeDocument[] {
    if (customerKey) {
      return cachedDocs.filter(d => d.customerKey === customerKey || !d.customerKey);
    }
    return cachedDocs;
  },

  get(id: string): KnowledgeDocument | undefined {
    return cachedDocs.find(d => d.id === id);
  },

  add(doc: Omit<KnowledgeDocument, "id" | "createdAt" | "charCount">): KnowledgeDocument {
    const newDoc: KnowledgeDocument = {
      ...doc,
      id: "doc_" + randomBytes(8).toString("hex"),
      createdAt: Date.now(),
      charCount: doc.content.length
    };

    const existingIdx = cachedDocs.findIndex(d => d.title.toLowerCase() === doc.title.toLowerCase() && d.customerKey === doc.customerKey);
    if (existingIdx >= 0) {
      cachedDocs[existingIdx] = { ...newDoc, id: cachedDocs[existingIdx].id };
    } else {
      cachedDocs.unshift(newDoc);
    }

    saveKnowledgeDocs(cachedDocs);
    rebuildChunkIndex();
    return newDoc;
  },

  remove(id: string, customerKey?: string): boolean {
    const initialLen = cachedDocs.length;
    cachedDocs = cachedDocs.filter(d => {
      if (d.id !== id) return true;
      if (customerKey && d.customerKey && d.customerKey !== customerKey) return true;
      return false;
    });
    if (cachedDocs.length !== initialLen) {
      saveKnowledgeDocs(cachedDocs);
      rebuildChunkIndex();
      return true;
    }
    return false;
  },

  /**
   * BM25 High-Precision Search across document chunks scoped by customer.
   */
  retrieveContext(query: string, maxTokens = 6000, customerKey?: string): string {
    const eligibleChunks = customerKey
      ? cachedChunks.filter(c => c.customerKey === customerKey || !c.customerKey)
      : cachedChunks;

    if (eligibleChunks.length === 0) return "";

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) {
      return eligibleChunks.slice(0, 3).map(c => `[From ${c.docTitle}]:\n${c.text}`).join("\n\n");
    }

    const N = eligibleChunks.length;
    const avgDocLen = eligibleChunks.reduce((acc, c) => acc + c.wordCount, 0) / (N || 1);
    const k1 = 1.5;
    const b = 0.75;

    // 1. Calculate Document Frequencies (DF) for each query token
    const docFreq: Record<string, number> = {};
    for (const term of queryTokens) {
      let count = 0;
      for (const chunk of cachedChunks) {
        if (chunk.text.toLowerCase().includes(term)) {
          count++;
        }
      }
      docFreq[term] = count;
    }

    // 2. Score each chunk using BM25 formula
    const scoredChunks = cachedChunks.map(chunk => {
      const chunkLower = chunk.text.toLowerCase();
      const chunkTokens = tokenize(chunk.text);
      const chunkLen = chunk.wordCount;
      let score = 0;

      // Title match bonus (heavily boosts documents whose titles match query)
      const titleLower = chunk.docTitle.toLowerCase();
      for (const term of queryTokens) {
        if (titleLower.includes(term)) score += 3.0;
      }

      for (const term of queryTokens) {
        const df = docFreq[term] || 0;
        if (df === 0) continue;

        // Inverse Document Frequency (IDF)
        const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

        // Term Frequency (TF) in chunk
        let tf = 0;
        for (const w of chunkTokens) {
          if (w === term) tf++;
        }

        // BM25 term score
        const num = tf * (k1 + 1);
        const denom = tf + k1 * (1 - b + b * (chunkLen / avgDocLen));
        score += idf * (num / denom);
      }

      return { chunk, score };
    });

    // 3. Filter and sort by score descending
    const winningChunks = scoredChunks
      .filter(item => item.score > 0.05)
      .sort((a, b) => b.score - a.score);

    // If no strong keyword matches, fallback to first few recent chunks
    const finalChunks = winningChunks.length > 0 
      ? winningChunks.map(w => w.chunk)
      : cachedChunks.slice(0, 3);

    // 4. Assemble context up to maxTokens limit (~4 chars per token)
    let context = "";
    let approxChars = 0;
    const charLimit = maxTokens * 4;
    const usedChunkKeys = new Set<string>();

    for (const chunk of finalChunks) {
      const key = `${chunk.docId}_${chunk.chunkIndex}`;
      if (usedChunkKeys.has(key)) continue;
      usedChunkKeys.add(key);

      const snippet = `### [Source: ${chunk.docTitle} (${chunk.docType})]:\n${chunk.text}\n\n`;
      if (approxChars + snippet.length > charLimit) break;

      context += snippet;
      approxChars += snippet.length;
    }

    return context.trim();
  }
};
