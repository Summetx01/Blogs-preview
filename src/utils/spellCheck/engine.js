class SpellCheckEngine {
  constructor() {
    this.customDictionary = new Set();
    this.isInitialized = false;
    this.useAPI = true; // Always prefer API
    this.apiCache = new Map(); // Cache API results
  }

  async initialize() {
    try {
      // Load custom technical dictionary
      await this.loadCustomDictionary();

      // Test API availability
      await this.testAPIConnection();

      this.isInitialized = true;
      console.log("Spell check engine initialized with LanguageTool API");
    } catch (error) {
      console.warn("LanguageTool API not available:", error);
      this.useAPI = false;
      this.isInitialized = true;
      console.log(
        "Spell check engine running in limited mode (custom dictionary only)"
      );
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

      console.log("LanguageTool API is available");
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
        console.log(`Loaded ${terms.length} custom terms`);
      }
    } catch (error) {
      console.warn("Could not load custom dictionary:", error);
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
    errors = this.filterErrors(errors, text);

    // Cache the result
    this.apiCache.set(cacheKey, errors);

    return errors;
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

      // Skip if in custom dictionary
      if (this.customDictionary.has(word)) return false;

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

  addToCustomDictionary(word) {
    if (word && typeof word === "string") {
      this.customDictionary.add(word.toLowerCase());
      console.log(`Added "${word}" to custom dictionary`);
    }
  }
}

// Singleton instance
let spellCheckEngine = null;

export const getSpellCheckEngine = async () => {
  if (!spellCheckEngine) {
    spellCheckEngine = new SpellCheckEngine();
    await spellCheckEngine.initialize();
  }
  return spellCheckEngine;
};

export default SpellCheckEngine;
