# tn80s-ui-pack

A VS Code extension providing the **Tomorrow Night 80s** dark color theme family for editors and UI.

## Themes

| Label                               | File                       |
| ----------------------------------- | -------------------------- |
| Tomorrow Night 80s & Code Dark 2026 | `themes/tn80s-pure.json`   |
| Tomorrow Night 80s Bright Chroma    | `themes/tn80s-chroma.json` |

Each theme file is a standard VS Code color theme JSON containing two sections:

- **`colors`** — UI token colors (workbench, editor chrome, etc.)
- **`tokenColors`** — syntax highlighting rules with scope selectors and foreground values

## Repository structure

```text
themes/          VS Code theme JSON files
src/             Tooling scripts
  generate-swatches.js   Pencil swatch generator
  generate-json.js       Pencil → theme JSON converter
  swatch-conversion.md   Swatch structure reference
```

## Generating Pencil swatches

`src/generate-swatches.js` reads a theme file and writes a `.pen` Pencil design file containing color swatches for every `colors` entry and every `tokenColors` rule that defines a foreground.

Swatches are grouped into two top-level frames:

- `#colors` — one swatch per UI color token
- `#tokenColors` — one swatch per syntax scope rule

### Usage

```sh
node src/generate-swatches.js <path-to-theme.json> <output.pen>
```

#### Example

```sh
node src/generate-swatches.js themes/tn80s-pure.json tn80s-pure.pen
```

### Extending transformations

Key and value transformations are defined as standalone functions at the top of the script, making them easy to override:

| Function                          | Purpose                                                           |
| --------------------------------- | ----------------------------------------------------------------- |
| `transformColorKey(key)`          | Reshape a `colors` token name                                     |
| `transformColorValue(value)`      | Reshape a `colors` hex value                                      |
| `transformTokenKey(scope)`        | Convert a scope string or array to a label (default: join with `\ |
| `transformTokenValue(foreground)` | Reshape a `tokenColors` foreground value                          |
| `transformFontStyle(fontStyle)`   | Map `fontStyle` strings to Pencil text properties                 |

## Generating theme JSON from a Pencil file

`src/generate-json.js` is the inverse of `generate-swatches.js`. It reads a `.pen` file and reconstructs a VS Code color theme JSON with `colors` and `tokenColors` sections.

Swatch frames are identified by the prefix of their name:

- `#<token>` — collected into the `colors` object; rectangle fill becomes the hex value
- `$<scope>` — collected into the `tokenColors` array; rectangle fill becomes `settings.foreground`, and `|`-separated text content is split back into a scope array

### CLI usage

```sh
node src/generate-json.js <input.pen> <output-theme.json>
```

```sh
node src/generate-json.js tn80s-pure.pen themes/tn80s-pure-restored.json
```

#### watch mode

```sh
node src/generate-json.js --watch src/tn80s-chroma.pen themes/tn80s-chroma.json
```

### Reverse transformations

Each transformation step is a standalone function for easy override:

| Function                       | Purpose                                                   |
| ------------------------------ | --------------------------------------------------------- |
| `restoreColorKey(name)`        | Strip `#` prefix from frame name to recover the token key |
| `restoreColorValue(fill)`      | Map rectangle fill back to a `colors` hex value           |
| `restoreTokenScope(name)`      | Strip `$`, split on `\                                    |
| `restoreTokenForeground(fill)` | Map rectangle fill to `settings.foreground`               |
| `restoreFontStyle(textNode)`   | Reconstruct `fontStyle` string from text node properties  |

### Package vsix

```sh
vsce package
```

## Useful links

- https://themes.vscode.one/ visual editor where colors can be checked