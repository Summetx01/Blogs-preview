/**
 * PortableText Text Extractor
 * Extracts plain text from PortableText content while preserving position information
 */

export class PortableTextExtractor {
  constructor() {
    this.textSegments = [];
    this.currentPosition = 0;
  }

  extractText(portableTextContent) {
    this.textSegments = [];
    this.currentPosition = 0;

    if (!portableTextContent || !Array.isArray(portableTextContent)) {
      return { text: "", segments: [] };
    }

    const extractedText = this.processBlocks(portableTextContent);

    return {
      text: extractedText,
      segments: this.textSegments,
    };
  }

  processBlocks(blocks) {
    let fullText = "";

    blocks.forEach((block, blockIndex) => {
      const blockText = this.processBlock(block, blockIndex);
      if (blockText) {
        fullText += blockText;
        // Add spacing between blocks
        if (blockIndex < blocks.length - 1) {
          fullText += "\n\n";
          this.currentPosition += 2;
        }
      }
    });

    return fullText;
  }

  processBlock(block, blockIndex) {
    if (!block || typeof block !== "object") return "";

    const { _type, style, children } = block;

    // Skip code blocks and other non-text content
    if (this.shouldSkipBlock(block)) {
      return "";
    }

    // Process different block types
    switch (_type) {
      case "block":
        return this.processTextBlock(block, blockIndex);
      case "image":
      case "table":
      case "carouselBlock":
      case "videoBlock":
        // Skip media blocks
        return "";
      default:
        // Try to process as text block if it has children
        if (children && Array.isArray(children)) {
          return this.processTextBlock(block, blockIndex);
        }
        return "";
    }
  }

  processTextBlock(block, blockIndex) {
    const { children, style = "normal" } = block;

    if (!children || !Array.isArray(children)) return "";

    let blockText = "";
    const blockStart = this.currentPosition;

    children.forEach((child, childIndex) => {
      const childText = this.processChild(child, blockIndex, childIndex);
      blockText += childText;
    });

    // Store block information for DOM mapping
    if (blockText.trim()) {
      this.textSegments.push({
        type: "block",
        style,
        text: blockText,
        start: blockStart,
        end: this.currentPosition,
        blockIndex,
        elementId: `block-${blockIndex}`,
      });
    }

    return blockText;
  }

  processChild(child, blockIndex, childIndex) {
    if (!child || typeof child !== "object") return "";

    const { _type, text, children } = child;

    if (_type === "span" && text) {
      // This is a text span
      const spanStart = this.currentPosition;
      const spanText = text;

      this.textSegments.push({
        type: "span",
        text: spanText,
        start: spanStart,
        end: spanStart + spanText.length,
        blockIndex,
        childIndex,
        elementId: `span-${blockIndex}-${childIndex}`,
        marks: child.marks || [],
      });

      this.currentPosition += spanText.length;
      return spanText;
    }

    // Handle nested children (for complex formatting)
    if (children && Array.isArray(children)) {
      let childText = "";
      children.forEach((nestedChild, nestedIndex) => {
        childText += this.processChild(
          nestedChild,
          blockIndex,
          `${childIndex}-${nestedIndex}`
        );
      });
      return childText;
    }

    return "";
  }

  shouldSkipBlock(block) {
    const { _type, style, markDefs } = block;

    // Skip code blocks
    if (style === "code" || _type === "code") return true;

    // Skip media blocks
    if (["image", "table", "carouselBlock", "videoBlock"].includes(_type))
      return true;

    // Skip blocks with code marks
    if (markDefs && markDefs.some((mark) => mark._type === "code")) return true;

    return false;
  }

  // Find the DOM element for a text segment
  findDOMElement(segment) {
    const element = document.getElementById(segment.elementId);
    if (element) return element;

    // Fallback: try to find by data attributes
    return (
      document.querySelector(`[data-block="${segment.blockIndex}"]`) ||
      document.querySelector(
        `[data-span="${segment.blockIndex}-${segment.childIndex}"]`
      )
    );
  }

  // Map text position to segment
  getSegmentAtPosition(position) {
    return this.textSegments.find(
      (segment) => position >= segment.start && position < segment.end
    );
  }

  // Get word boundaries within a segment
  getWordInSegment(segment, globalPosition) {
    const localPosition = globalPosition - segment.start;
    const text = segment.text;

    // Find word boundaries
    const beforeText = text.substring(0, localPosition);
    const afterText = text.substring(localPosition);

    const wordStart = beforeText.lastIndexOf(" ") + 1;
    const wordEndMatch = afterText.match(/\s/);
    const wordEnd = wordEndMatch
      ? localPosition + wordEndMatch.index
      : text.length;

    return {
      word: text.substring(wordStart, wordEnd),
      start: segment.start + wordStart,
      end: segment.start + wordEnd,
      segment,
    };
  }
}

// DOM Text Extractor for already rendered content
export class DOMTextExtractor {
  constructor(containerElement) {
    this.container = containerElement;
    this.textNodes = [];
  }

  extractText() {
    this.textNodes = [];
    const text = this.walkTextNodes(this.container);
    return {
      text,
      textNodes: this.textNodes,
    };
  }

  walkTextNodes(element, currentOffset = 0) {
    let text = "";

    for (let node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const nodeText = node.textContent || "";
        this.textNodes.push({
          node,
          text: nodeText,
          start: currentOffset,
          end: currentOffset + nodeText.length,
        });
        text += nodeText;
        currentOffset += nodeText.length;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Skip code elements and other non-text content
        if (this.shouldSkipElement(node)) {
          continue;
        }

        const childText = this.walkTextNodes(node, currentOffset);
        text += childText;
        currentOffset += childText.length;
      }
    }

    return text;
  }

  shouldSkipElement(element) {
    const tagName = element.tagName?.toLowerCase();
    const className = element.className || "";

    // Skip code elements
    if (["code", "pre", "script", "style"].includes(tagName)) return true;

    // Skip elements with code-related classes
    if (className.includes("code") || className.includes("highlight"))
      return true;

    return false;
  }

  getTextNodeAtPosition(position) {
    return this.textNodes.find(
      (node) => position >= node.start && position < node.end
    );
  }
}

export default PortableTextExtractor;
