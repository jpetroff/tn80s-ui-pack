#!/usr/bin/env node
/**
 * generate-swatches.js
 *
 * Usage: node src/generate-swatches.js <path-to-theme.json>
 *
 * Reads "colors" and "tokenColors" from a VS Code theme JSON file and outputs
 * an array of Pencil swatch frame definitions (JSON) to stdout.
 * Feed the output into Pencil MCP batch_design to create .pen swatches.
 */

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

function newId() {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Key / value transformations — extend or replace these for custom behaviour
// ---------------------------------------------------------------------------

/**
 * Transform a "colors" section key (VS Code token name) into a swatch label.
 * @param {string} key
 * @returns {string}
 */
function transformColorKey(key) {
  return key;
}

/**
 * Transform a "colors" section value (hex string) into a fill value.
 * @param {string} value
 * @returns {string}
 */
function transformColorValue(value) {
  return value;
}

/**
 * Transform a "tokenColors" scope (string or string[]) into a swatch label.
 * Multiple scopes are joined with "|".
 * @param {string|string[]} scope
 * @returns {string}
 */
function transformTokenKey(scope) {
  return Array.isArray(scope) ? scope.join('|') : scope;
}

/**
 * Transform tokenColors settings.foreground into a fill value.
 * @param {string} foreground
 * @returns {string}
 */
function transformTokenValue(foreground) {
  return foreground;
}

/**
 * Transform tokenColors settings.fontStyle into a Pencil fontWeight / fontStyle.
 * Returns an object with only the properties that differ from the defaults.
 * @param {string|undefined} fontStyle  e.g. "bold", "italic", "bold italic"
 * @returns {{ fontWeight?: string, fontStyle?: string }}
 */
function transformFontStyle(fontStyle) {
  if (!fontStyle) return {};
  const parts = fontStyle.split(/\s+/);
  const result = {};
  if (parts.includes('bold')) result.fontWeight = 'bold';
  if (parts.includes('italic')) result.fontStyle = 'italic';
  if (parts.includes('underline')) result.textDecoration = 'underline';
  return result;
}

// ---------------------------------------------------------------------------
// Swatch builder
// ---------------------------------------------------------------------------

function getColorsFrame(children = []) {
	return {
		type: 'frame',
    id: newId(),
    name: 'colors',
    gap: 8,
		x: 0, 
		y: 0,
    alignItems: 'center',
		layout: "vertical",
		gap: 4,
		alignItems: "end",
		width: 300,
		children
	}
}

function getTokenColorsFrame(children = []) {
	return {
		type: 'frame',
    id: newId(),
    name: 'tokenColors',
    gap: 8,
		x: 1024,
		y: 0,
    alignItems: 'center',
		layout: "vertical",
		gap: 4,
		alignItems: "end",
		width: 600,
		children
	}
}

/**
 * Build a single Pencil swatch frame definition.
 *
 * @param {string} key   Display label and rectangle fill token
 * @param {string} value Hex colour used for the text label fill
 * @param {object} [textOverrides]  Extra text node properties (e.g. fontStyle)
 * @returns {object}  Pencil frame node
 */
function buildSwatch(prefix, key, value, textOverrides = {}) {
  return {
    type: 'frame',
    id: newId(),
    name: prefix + key,
    gap: 8,
		width: "fill_container",
    alignItems: 'center',
    children: [
      {
        type: 'text',
        id: newId(),
        fill: value,
				width: "fill_container",
				textGrowth: "fixed-width",
				textAlign: "right",
        content: key,
        fontFamily: 'Inter',
        fontSize: 10,
        fontWeight: 'normal',
        ...textOverrides,
      },
      {
        type: 'rectangle',
        id: newId(),
        fill: value,
        width: 32,
        height: 32,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Section parsers
// ---------------------------------------------------------------------------

/**
 * Parse the flat "colors" object into an array of swatch definitions.
 * @param {Record<string, string>} colors
 * @returns {object[]}
 */
function parseColors(colors) {
  return Object.entries(colors).map(([rawKey, rawValue]) => {
    const key = transformColorKey(rawKey);
    const value = transformColorValue(rawValue);
    return buildSwatch('#', key, value);
  });
}

/**
 * Parse the "tokenColors" array into an array of swatch definitions.
 * Entries without settings.foreground are skipped.
 * @param {object[]} tokenColors
 * @returns {object[]}
 */
function parseTokenColors(tokenColors) {
  const swatches = [];
  for (const token of tokenColors) {
    const { scope, settings = {} } = token;
    if (!settings.foreground) continue;

    const key = transformTokenKey(scope);
    const value = transformTokenValue(settings.foreground);
    const textOverrides = transformFontStyle(settings.fontStyle);

    swatches.push(buildSwatch('$', key, value, textOverrides));
  }
  return swatches;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const [, , themePath, outPath] = process.argv;
  if (!themePath || !outPath) {
    console.error('Usage: node src/generate-swatches.js <path-to-theme.json> <output.pen>');
    process.exit(1);
  }

  const resolvedTheme = path.resolve(themePath);
  if (!fs.existsSync(resolvedTheme)) {
    console.error(`File not found: ${resolvedTheme}`);
    process.exit(1);
  }

  const theme = JSON.parse(fs.readFileSync(resolvedTheme, 'utf8'));

  const frames = [
    getColorsFrame(theme.colors ? parseColors(theme.colors) : []),
    getTokenColorsFrame(theme.tokenColors ? parseTokenColors(theme.tokenColors) : []),
  ];

  const pen = {
    version: '2.10',
    children: frames,
  };

  const resolvedOut = path.resolve(outPath);
  fs.writeFileSync(resolvedOut, JSON.stringify(pen, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${frames[0].children.length + frames[1].children.length} swatches to ${resolvedOut}`);
}

main();
