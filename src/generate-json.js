#!/usr/bin/env node
/**
 * generate-json.js
 *
 * Usage: node src/generate-json.js [--watch] <input.pen> <output-theme.json>
 *
 * Parses a Pencil .pen file produced by generate-swatches.js and reconstructs
 * a VS Code color theme JSON with "colors" and "tokenColors" sections.
 *
 * Swatch frame naming conventions (set by generate-swatches.js):
 *   #<token>   → entry in "colors"      { token: hexValue }
 *   $<scope>   → entry in "tokenColors" { scope: [...], settings: { foreground } }
 */

import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Reverse transformations — mirror the functions in generate-swatches.js
// ---------------------------------------------------------------------------

/**
 * Restore a colors key from the swatch frame name (strips leading "#").
 * @param {string} name  Frame name, e.g. "#editor.background"
 * @returns {string}
 */
function restoreColorKey(name) {
  return name.slice(1);
}

/**
 * Restore a colors value from the rectangle fill.
 * @param {string} fill  Hex color string
 * @returns {string}
 */
function restoreColorValue(fill) {
  return fill;
}

/**
 * Restore a tokenColors scope from the swatch frame name (strips leading "$").
 * Single-scope entries are returned as a plain string; multi-scope as an array.
 * @param {string} name  Frame name, e.g. "$comment|comment.line"
 * @returns {string|string[]}
 */
function restoreTokenScope(name) {
  const raw = name.slice(1);
  const parts = raw.split('|');
  return parts.length === 1 ? parts[0] : parts;
}

/**
 * Restore tokenColors settings.foreground from the rectangle fill.
 * @param {string} fill
 * @returns {string}
 */
function restoreTokenForeground(fill) {
  return fill;
}

/**
 * Reconstruct a fontStyle string from Pencil text node properties.
 * Reverses transformFontStyle() from generate-swatches.js.
 * @param {{ fontWeight?: string, fontStyle?: string, textDecoration?: string }} textNode
 * @returns {string|undefined}
 */
function restoreFontStyle(textNode) {
  const parts = [];
  if (textNode.fontStyle === 'italic') parts.push('italic');
  if (textNode.fontWeight === 'bold') parts.push('bold');
  if (textNode.textDecoration === 'underline') parts.push('underline');
  return parts.length > 0 ? parts.join(' ') : undefined;
}

// ---------------------------------------------------------------------------
// Node helpers
// ---------------------------------------------------------------------------

/**
 * Find the first child node matching a type predicate.
 * @param {object[]} children
 * @param {string} type
 * @returns {object|undefined}
 */
function findChild(children, type) {
  return (children ?? []).find((c) => c.type === type);
}

// ---------------------------------------------------------------------------
// Swatch parsers
// ---------------------------------------------------------------------------

/**
 * Extract a { key, value } colors entry from a "#"-prefixed swatch frame.
 * Returns null if the frame does not have the expected text + rectangle children.
 * @param {object} frame
 * @returns {{ key: string, value: string }|null}
 */
function extractColorSwatch(frame) {
  const rect = findChild(frame.children, 'rectangle');
  const text = findChild(frame.children, 'text');
  if (!rect || !text) return null;

  return {
    key: restoreColorKey(frame.name),
    value: restoreColorValue(rect.fill),
  };
}

/**
 * Extract a tokenColors entry object from a "$"-prefixed swatch frame.
 * Returns null if the frame does not have the expected text + rectangle children.
 * @param {object} frame
 * @returns {{ scope: string|string[], settings: object }|null}
 */
function extractTokenSwatch(frame) {
  const rect = findChild(frame.children, 'rectangle');
  const text = findChild(frame.children, 'text');
  if (!rect || !text) return null;

  const settings = {
    foreground: restoreTokenForeground(rect.fill),
  };

  const fontStyle = restoreFontStyle(text);
  if (fontStyle) settings.fontStyle = fontStyle;

  return {
    scope: restoreTokenScope(frame.name),
    settings,
  };
}

// ---------------------------------------------------------------------------
// Recursive walker
// ---------------------------------------------------------------------------

/**
 * Walk all nodes in the tree, calling visitor on each.
 * @param {object|object[]} node
 * @param {(node: object) => void} visitor
 */
function walk(node, visitor) {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visitor);
    return;
  }
  visitor(node);
  if (node.children) walk(node.children, visitor);
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

/**
 * Read a .pen file and write the reconstructed VS Code theme JSON.
 * @param {string} resolvedPen  Absolute path to the input .pen file
 * @param {string} resolvedOut  Absolute path to the output .json file
 */
function convert(resolvedPen, resolvedOut) {
  const pen = JSON.parse(fs.readFileSync(resolvedPen, 'utf8'));

  const colors = {};
  const tokenColors = [];

  walk(pen.children ?? [], (node) => {
    if (node.type !== 'frame' || !node.name) return;

    if (node.name.startsWith('#')) {
      const entry = extractColorSwatch(node);
      if (entry) colors[entry.key] = entry.value;
    } else if (node.name.startsWith('$')) {
      const entry = extractTokenSwatch(node);
      if (entry) tokenColors.push(entry);
    }
  });

  const theme = {
    $schema: 'vscode://schemas/color-theme',
    name: '',
    type: 'dark',
    colors,
    tokenColors,
  };

  fs.writeFileSync(resolvedOut, JSON.stringify(theme, null, 2) + '\n', 'utf8');
  const ts = new Date().toLocaleTimeString();
  console.log(`[${ts}] Wrote ${Object.keys(colors).length} colors and ${tokenColors.length} tokenColors to ${resolvedOut}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const watchMode = args.includes('--watch');
  const positional = args.filter((a) => !a.startsWith('--'));

  const [penPath, outPath] = positional;
  if (!penPath || !outPath) {
    console.error('Usage: node src/generate-json.js [--watch] <input.pen> <output-theme.json>');
    process.exit(1);
  }

  const resolvedPen = path.resolve(penPath);
  if (!fs.existsSync(resolvedPen)) {
    console.error(`File not found: ${resolvedPen}`);
    process.exit(1);
  }

  const resolvedOut = path.resolve(outPath);

  convert(resolvedPen, resolvedOut);

  if (watchMode) {
    console.log(`Watching ${resolvedPen} for changes…`);

    // Debounce to avoid double-firing on some editors/tools that write in two steps
    let debounceTimer = null;
    fs.watch(resolvedPen, (eventType) => {
      if (eventType !== 'change') return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        try {
          convert(resolvedPen, resolvedOut);
        } catch (err) {
          console.error(`Error during conversion: ${err.message}`);
        }
      }, 100);
    });
  }
}

main();
