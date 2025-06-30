import { createClient } from "@sanity/client";

// Browser-safe Sanity client for spell check (no write token needed here)
const browserClient = createClient({
  projectId: "9sed75bn",
  dataset: "production",
  apiVersion: "2024-03-11",
  useCdn: true,
  // No token - this will be read-only for fetching custom words
});

class SpellCheckEngine {
  constructor() {
    this.customDictionary = new Set();
    this.sanityWords = new Set(); // Cache Sanity words
    this.isInitialized = false;
    this.useAPI = true; // Always prefer API
    this.apiCache = new Map(); // Cache API results
    this.rawApiResults = new Map(); // Store raw API results before filtering
    this.STORAGE_KEY = "spellcheck_sanity_words";
  }

  async initialize() {
    try {
      // Clear any existing cache to ensure fresh start
      this.apiCache.clear();
      this.rawApiResults.clear();

      // Load custom technical dictionary
      await this.loadCustomDictionary();

      // Load custom words from Sanity
      await this.loadSanityWords();

      // Test API availability
      await this.testAPIConnection();

      this.isInitialized = true;
    } catch (error) {
      console.warn("LanguageTool API not available:", error);
      this.useAPI = false;
      this.isInitialized = true;
    }
  }

  async testAPIConnection() {
    try {
      const response = await fetch("https://api.languagetool.org/v2/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          text: "test",
          language: "en-US",
        }),
      });

      if (!response.ok) throw new Error("API not available");

      this.useAPI = true;
    } catch (error) {
      console.warn("LanguageTool API not available");
      this.useAPI = false;
      throw error;
    }
  }

  async loadCustomDictionary() {
    try {
      const response = await fetch("/dictionaries/technical-terms.json");
      if (response.ok) {
        const terms = await response.json();
        terms.forEach((term) => this.customDictionary.add(term.toLowerCase()));
      }
    } catch (error) {
      console.warn("Could not load custom dictionary:", error);
    }
  }

  async loadSanityWords() {
    try {
      // Load from browser storage first (handles propagation delays)
      const storedWords = this.loadWordsFromStorage();
      storedWords.forEach((word) => this.sanityWords.add(word.toLowerCase()));

      // Then fetch from Sanity and merge
      const customWords = await browserClient.fetch(
        '*[_type == "customWords"]{word}'
      );

      customWords.forEach((item) => {
        if (item.word) {
          this.sanityWords.add(item.word.toLowerCase());
        }
      });

      // Update storage with the merged list
      this.saveWordsToStorage(Array.from(this.sanityWords));
    } catch (error) {
      console.warn("Could not load custom words from Sanity:", error);
      // Fallback to storage only if Sanity fails
      const storedWords = this.loadWordsFromStorage();
      storedWords.forEach((word) => this.sanityWords.add(word.toLowerCase()));
    }
  }

  loadWordsFromStorage() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn("Could not load words from storage:", error);
      return [];
    }
  }

  saveWordsToStorage(words) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(words));
    } catch (error) {
      console.warn("Could not save words to storage:", error);
    }
  }

  async addWordToSanity(word) {
    try {
      const response = await fetch("/api/spell-check/add-word", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ word }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Add to local cache
        this.sanityWords.add(word.toLowerCase());

        // Add to browser storage immediately (handles propagation delay)
        const currentWords = Array.from(this.sanityWords);
        this.saveWordsToStorage(currentWords);

        // Re-filter existing results with updated dictionaries
        await this.refilterCachedResults();
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error("Error adding word to Sanity:", error);
      throw error;
    }
  }

  async refilterCachedResults() {
    // First, reload Sanity words to get the latest data
    await this.loadSanityWords();

    // Then re-filter all cached results with updated dictionaries
    for (const [cacheKey, rawResults] of this.rawApiResults.entries()) {
      const filteredResults = this.filterErrors(rawResults, cacheKey);
      this.apiCache.set(cacheKey, filteredResults);
    }
  }

  async checkText(text) {
    if (!text || typeof text !== "string") return [];

    // Check cache first
    const cacheKey = text.toLowerCase().trim();
    if (this.apiCache.has(cacheKey)) {
      return this.apiCache.get(cacheKey);
    }

    let errors = [];

    if (this.useAPI) {
      try {
        errors = await this.checkTextWithAPI(text);
        // Store raw results before filtering
        this.rawApiResults.set(cacheKey, [...errors]);
      } catch (error) {
        console.warn("API check failed:", error);
        // Return empty array if API fails instead of local fallback
        errors = [];
      }
    } else {
      // Just return empty array if no API - rely on custom dictionary filtering
      errors = [];
    }

    // Filter out technical terms and false positives
    const filteredErrors = this.filterErrors(errors, text);

    // Cache the filtered result
    this.apiCache.set(cacheKey, filteredErrors);

    return filteredErrors;
  }

  async checkTextWithAPI(text) {
    try {
      const response = await fetch("https://api.languagetool.org/v2/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          text: text,
          language: "en-US",
          enabledOnly: "false",
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      return data.matches.map((match) => ({
        word: text.substring(match.offset, match.offset + match.length),
        start: match.offset,
        end: match.offset + match.length,
        suggestions: match.replacements?.slice(0, 5).map((r) => r.value) || [],
        message: match.message,
        category: match.rule?.category?.id || "SPELLING",
        ruleId: match.rule?.id,
      }));
    } catch (error) {
      console.error("LanguageTool API error:", error);
      throw error;
    }
  }

  filterErrors(errors, originalText) {
    return errors.filter((error) => {
      const word = error.word.toLowerCase();

      // Skip if in custom dictionary (technical terms)
      if (this.customDictionary.has(word)) return false;

      // Skip if in Sanity custom words
      if (this.sanityWords.has(word)) return false;

      // Skip technical terms
      if (this.isLikelyTechnical(word)) return false;

      // Skip contractions
      if (this.isContraction(word)) return false;

      // Skip certain rule types that are too aggressive
      const skipRules = [
        "UPPERCASE_SENTENCE_START", // Don't enforce capitalization
        "WHITESPACE_RULE", // Skip whitespace issues
        "DOUBLE_PUNCTUATION", // Skip double punctuation
      ];

      if (skipRules.includes(error.ruleId)) return false;

      // Only keep spelling and some grammar errors
      const allowedCategories = ["TYPOS", "SPELLING", "GRAMMAR"];
      if (
        error.category &&
        !allowedCategories.some((cat) => error.category.includes(cat))
      )
        return false;

      return true;
    });
  }

  isContraction(word) {
    const contractions = [
      "don't",
      "won't",
      "can't",
      "couldn't",
      "wouldn't",
      "shouldn't",
      "didn't",
      "doesn't",
      "haven't",
      "hasn't",
      "hadn't",
      "isn't",
      "aren't",
      "wasn't",
      "weren't",
      "i'm",
      "you're",
      "he's",
      "she's",
      "it's",
      "we're",
      "they're",
      "i've",
      "you've",
      "we've",
      "they've",
      "i'll",
      "you'll",
      "he'll",
      "she'll",
      "it'll",
      "we'll",
      "they'll",
      "i'd",
      "you'd",
      "he'd",
      "she'd",
      "it'd",
      "we'd",
      "they'd",
      "let's",
      "that's",
      "what's",
      "where's",
      "when's",
      "who's",
      "how's",
      "why's",
      "there's",
      "here's",
    ];
    return contractions.includes(word.toLowerCase());
  }

  isLikelyTechnical(word) {
    // Skip if contains numbers
    if (/\d/.test(word)) return true;

    // Skip if camelCase
    if (/[a-z][A-Z]/.test(word)) return true;

    // Skip if all caps and short (likely acronym)
    if (word.length <= 5 && word === word.toUpperCase()) return true;

    // Skip if contains underscores
    if (/_/.test(word)) return true;

    // Skip URLs and emails
    if (word.includes("@") || word.includes(".com") || word.includes("http"))
      return true;

    // Skip file extensions
    if (
      /\.(js|ts|html|css|json|xml|yml|yaml|md|txt|pdf|png|jpg|jpeg|gif|svg)$/i.test(
        word
      )
    )
      return true;

    // Skip programming keywords
    const programmingTerms = [
      "const",
      "let",
      "var",
      "function",
      "return",
      "import",
      "export",
      "class",
      "interface",
      "type",
      "enum",
      "namespace",
      "async",
      "await",
      "true",
      "false",
      "null",
      "undefined",
      "typeof",
      "instanceof",
    ];
    if (programmingTerms.includes(word.toLowerCase())) return true;

    return false;
  }

  async addToCustomDictionary(word) {
    if (word && typeof word === "string") {
      try {
        // Add to Sanity
        await this.addWordToSanity(word);

        // Also add to local memory for immediate effect
        this.customDictionary.add(word.toLowerCase());

        return true;
      } catch (error) {
        console.error(`Failed to add "${word}" to dictionary:`, error);
        // Still add to local memory as fallback
        this.customDictionary.add(word.toLowerCase());
        return false;
      }
    }
    return false;
  }
}

// Singleton instance
let spellCheckEngine = null;

export const getSpellCheckEngine = async () => {
  if (!spellCheckEngine) {
    spellCheckEngine = new SpellCheckEngine();
    await spellCheckEngine.initialize();
  } else {
    // Always reload Sanity words to get latest data
    await spellCheckEngine.loadSanityWords();
  }
  return spellCheckEngine;
};

export default SpellCheckEngine;
