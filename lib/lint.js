const fs = require('fs/promises');
const path = require('path');
const _unified = require('unified');
let unified = _unified && _unified.default ? _unified.default : _unified;
if (typeof unified !== 'function' && unified && typeof unified.unified === 'function') unified = unified.unified;
const _remarkParse = require('remark-parse');
const remarkParse = _remarkParse && _remarkParse.default ? _remarkParse.default : _remarkParse;
const _visit = require('unist-util-visit');
let visit = _visit && _visit.default ? _visit.default : _visit;
if (visit && typeof visit !== 'function' && typeof visit.visit === 'function') visit = visit.visit;
const _globby = require('globby');
let globby = _globby && _globby.default ? _globby.default : _globby;
if (typeof globby !== 'function' && globby && typeof globby.globby === 'function') globby = globby.globby;
const _execa = require('execa');
let execa = _execa && _execa.default ? _execa.default : _execa;
if (execa && typeof execa.execa === 'function') execa = execa.execa;

async function expandPatterns(patterns) {
  if (!Array.isArray(patterns)) patterns = [patterns];
  const files = await globby(patterns, { gitignore: true });
  // filter to markdown extensions
  return files.filter(f => /\.md$/i.test(f));
}

function checkAltText() {
  return (tree, vfile) => {
    // handle inline images and reference-style images
    visit(tree, 'image', node => {
      const alt = node.alt || '';
      if (typeof alt !== 'string' || alt.trim() === '') {
        vfile.message('Image is missing alt text (important for accessibility)', node);
      }
    });
    visit(tree, 'imageReference', node => {
      const alt = node.alt || '';
      if (typeof alt !== 'string' || alt.trim() === '') {
        vfile.message('Image (reference) is missing alt text (important for accessibility)', node);
      }
    });
  };
}

function checkHeadingStructure() {
  return (tree, vfile) => {
    const headings = [];
    visit(tree, 'heading', node => {
      headings.push({ depth: node.depth, node });
    });

    if (headings.length === 0) return;

    if (headings[0].depth !== 1) {
      vfile.message('First heading should be H1 (#) for document title', headings[0].node);
    }

    const h1Count = headings.filter(h => h.depth === 1).length;
    if (h1Count > 1) {
      vfile.message('Document contains multiple H1 headings; prefer a single H1 per document.', headings[0].node);
    }
  };
}

function checkHtmlImageAlt() {
  // Detect HTML <img> tags without alt attribute in raw HTML nodes
  const imgRegex = /<img\b([^>]*?)>/gi;
  const altAttrRegex = /\balt\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i;

  return (tree, vfile) => {
    visit(tree, 'html', node => {
      const value = node.value || '';
      let m;
      while ((m = imgRegex.exec(value)) !== null) {
        const attrs = m[1] || '';
        if (!altAttrRegex.test(attrs)) {
          vfile.message('HTML <img> tag is missing alt attribute (accessibility)', node);
        }
      }
    });
  };
}

function checkCurriculumReadmeStructure() {
  return (tree, vfile) => {
    const fileName = path.basename(vfile.path || '');
    if (!/readme\.md$/i.test(fileName)) return;

    const headings = [];
    visit(tree, 'heading', node => {
      headings.push({ depth: node.depth, text: node.children?.map(child => child.value || '').join('') || '' });
    });

    const normalized = headings.map(h => h.text.trim().toLowerCase());
    const requiredHeadings = [
      {
        labels: ['introduction', 'overview'],
        message: 'Curriculum README should include an Introduction or Overview section.'
      },
      { label: 'tools & resources', message: 'Curriculum README should include a Tools & Resources section.' },
      { label: 'set up', message: 'Curriculum README should include a Set Up section.' }
    ];

    requiredHeadings.forEach(({ labels, label, message }) => {
      const matches = (labels || [label]).some(candidate => normalized.some(text => text.includes(candidate)));
      if (!matches) {
        vfile.message(message);
      }
    });
  };
}

function checkCodeFenceLanguages() {
  return (tree, vfile) => {
    visit(tree, 'code', node => {
      if (!node.lang || !String(node.lang).trim()) {
        vfile.message('Fenced code block should include a language identifier for clarity.', node);
      }
      if (!node.value || !String(node.value).trim()) {
        vfile.message('Empty code block found; add an example or remove the fence.', node);
      }
    });
  };
}

function checkHeadingLevels() {
  return (tree, vfile) => {
    const headings = [];
    visit(tree, 'heading', node => {
      headings.push(node.depth);
    });

    if (headings.length < 2) return;

    for (let i = 1; i < headings.length; i++) {
      const prev = headings[i - 1];
      const current = headings[i];
      if (current > prev + 1) {
        vfile.message(`Heading level jumps from H${prev} to H${current}; avoid skipping levels.`, {
          start: { line: i + 1, column: 1 },
          end: { line: i + 1, column: 1 }
        });
        break;
      }
    }
  };
}

function checkDuplicateHeadings() {
  return (tree, vfile) => {
    const seen = new Map();
    visit(tree, 'heading', node => {
      const text = node.children?.map(child => child.value || '').join('').trim().toLowerCase();
      if (!text) return;
      if (seen.has(text)) {
        vfile.message(`Duplicate heading found: "${text}". Consider making each section distinct.`, node);
      } else {
        seen.set(text, node);
      }
    });
  };
}

function checkHeadingContent() {
  return (tree, vfile) => {
    function walk(children) {
      children.forEach((child, index) => {
        if (child.type === 'heading') {
          const headingText = child.children?.map(grandchild => grandchild.value || '').join('').trim();
          if (!headingText) return;

          const following = children.slice(index + 1);
          const nextHeading = following.find(sibling => sibling.type === 'heading');

          if (!nextHeading) return;

          const hasContent = following.some(sibling => {
            if (sibling.type === 'heading') return false;
            if (sibling.type === 'paragraph' && sibling.children?.some(grandchild => grandchild.value?.trim())) return true;
            if (sibling.type === 'list' || sibling.type === 'code' || sibling.type === 'blockquote' || sibling.type === 'table' || sibling.type === 'html') return true;
            return false;
          });

          if (!hasContent) {
            vfile.message(`Heading "${headingText}" has no content below it. Add a paragraph, list, or code example.`, child);
          }
        }

        if (child && Array.isArray(child.children)) {
          walk(child.children);
        }
      });
    }

    if (tree && Array.isArray(tree.children)) {
      walk(tree.children);
    }
  };
}

function checkEmptyListItems() {
  return (tree, vfile) => {
    visit(tree, 'listItem', node => {
      const text = node.children?.map(child => child.value || '').join('').trim();
      const hasContent = node.children?.some(child => {
        if (child.type === 'paragraph' && child.children?.some(grandchild => grandchild.value?.trim())) return true;
        if (child.type === 'text' && child.value?.trim()) return true;
        return false;
      });

      if (!hasContent) {
        vfile.message('Empty list item found; add content to the bullet or checkbox.', node);
      }
    });
  };
}

function checkRelativeLinks() {
  return async (tree, vfile) => {
    const baseDir = path.dirname(vfile.path || '.');

    const checkNode = async node => {
      const href = node.url || '';
      if (!href || /^https?:\/\//i.test(href) || /^mailto:/i.test(href) || /^#/.test(href)) return;
      if (href.startsWith('javascript:')) return;

      const normalized = href.split('#')[0].split('?')[0];
      if (!normalized) return;

      const resolved = path.resolve(baseDir, normalized);
      try {
        await fs.access(resolved);
      } catch (err) {
        vfile.message(`Link target does not exist: ${href}`, node);
      }
    };

    const linkNodes = [];
    visit(tree, 'link', node => linkNodes.push(node));
    visit(tree, 'linkReference', node => linkNodes.push(node));

    for (const node of linkNodes) {
      await checkNode(node);
    }
  };
}

function createProcessor(options = {}) {
  const disabledRules = new Set((options.disabledRules || []).map(rule => String(rule).toLowerCase()));

  const plugins = [];
  const addRule = (name, plugin) => {
    if (!disabledRules.has(name)) plugins.push(plugin);
  };

  addRule('alt-text', checkAltText);
  addRule('html-alt', checkHtmlImageAlt);
  addRule('heading-structure', checkHeadingStructure);
  addRule('curriculum-readme', checkCurriculumReadmeStructure);
  addRule('code-fence-languages', checkCodeFenceLanguages);
  addRule('heading-levels', checkHeadingLevels);
  addRule('duplicate-headings', checkDuplicateHeadings);
  addRule('heading-content', checkHeadingContent);
  addRule('empty-list-items', checkEmptyListItems);
  addRule('relative-links', checkRelativeLinks);

  const processor = unified().use(remarkParse);
  plugins.forEach(plugin => processor.use(plugin));
  return processor;
}

async function lintFile(file, options = {}) {
  const content = await fs.readFile(file, 'utf8');
  const processor = createProcessor(options);

  const { VFile } = require('vfile');
  const vfile = new VFile({ path: file, value: content });
  const tree = processor.parse(vfile);
  await processor.run(tree, vfile);
  const msgs = (vfile.messages || []).map(m => ({
    message: m.message,
    ruleId: m.ruleId || m.source || null,
    location: m.location || m.position || null,
    fatal: !!m.fatal
  }));
  return { file, messages: msgs };
}

async function lintFiles(patterns, options = {}) {
  const files = await expandPatterns(patterns);
  const results = [];
  for (const f of files) {
    try {
      const r = await lintFile(f, options);
      results.push(r);
    } catch (err) {
      results.push({ file: f, messages: [{ message: `Error processing file: ${err.message}`, ruleId: 'processor', location: null, fatal: true }] });
    }
  }
  return results;
}

async function runSpellcheck(files) {
  if (!files || files.length === 0) return { found: true, problems: [] };

  // Try to call cspell if installed. If not found, return found:false
  try {
    // Use --no-summary to reduce noise; cspell returns non-zero exit when issues found
    const args = ['--no-color', '--no-progress', '--no-summary', ...files];
    const res = await execa('cspell', args, { reject: false });

    if (res.exitCode === 127 || /not found|No such file/i.test(res.stderr || '')) {
      return { found: false };
    }

    // cspell prints matches to stdout; collect lines
    const out = (res.stdout || '').trim();
    if (!out) return { found: true, problems: [] };

    const lines = out.split(/\r?\n/).filter(Boolean);
    return { found: true, problems: lines };
  } catch (err) {
    // If spawn failed because cspell not installed, indicate not found
    if (err && err.code === 'ENOENT') return { found: false };
    return { found: true, problems: [`Spellcheck error: ${err.message || err}`] };
  }
}

module.exports = { lintFiles, runSpellcheck };
