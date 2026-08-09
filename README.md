# curriculum-md-lint-cli

A lightweight CLI for linting curriculum markdown files. It is meant to be cloned or forked from GitHub, installed locally, and run directly from the repository.

Features:
- Uses remark to parse Markdown and apply custom structural and accessibility checks
- Checks for missing image alt text, HTML image alt attributes, heading structure, curriculum README sections, code-fence languages, heading-level jumps, duplicate headings, empty headings, empty list items, empty code blocks, and broken relative links
- Optionally runs `cspell` if it is available on your machine
- Supports disabling specific rules with `--disable` or `--disable=<rule>`

Quickstart
1. Clone or fork this repository from GitHub.

2. Install dependencies:

   npm install

3. (Optional) Install cspell globally to enable spellchecking:

   npm install -g cspell

4. Run the linter from the repository root:

   ./bin/cli.js "docs/**/*.md"

   You can also use:

   npm run lint -- "docs/**/*.md"

5. Disable one or more checks when needed:

   ./bin/cli.js --disable alt-text --disable heading-structure "docs/**/*.md"

   Or with the compact form:

   ./bin/cli.js --disable=relative-links "docs/**/*.md"

   Available rule names:
   - alt-text
   - html-alt
   - heading-structure
   - curriculum-readme
   - code-fence-languages
   - heading-levels
   - duplicate-headings
   - heading-content
   - empty-list-items
   - relative-links

Exit codes
- 0: no problems
- 2: problems found
- 1: internal error

Notes
- This repository is intentionally small and conservative; you can extend it with more rules as needed.
