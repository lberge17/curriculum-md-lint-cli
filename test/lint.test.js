const { expect } = require('chai');
const fs = require('fs/promises');
const path = require('path');
const { lintFiles, runSpellcheck } = require('../lib/lint');

describe('curriculum-md-lint', () => {
  const tmpDir = path.join(__dirname, 'tmp');

  before(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
  });

  beforeEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.mkdir(tmpDir, { recursive: true });
  });

  after(async () => {
    // cleanup
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('detects missing alt text and missing H1', async () => {
    const file = path.join(tmpDir, 'missing.md');
    const content = '## Subtitle\n\n![](img.png)\n';
    await fs.writeFile(file, content, 'utf8');
    const results = await lintFiles([tmpDir + '/*.md']);
    const r = results.find(r => r.file.endsWith('missing.md'));
    expect(r).to.exist;
    const msgs = r.messages.map(m => m.message.toLowerCase());
    expect(msgs.some(m => m.includes('alt'))).to.be.true;
    expect(msgs.some(m => m.includes('h1') || m.includes('first heading'))).to.be.true;
  });

  it('passes when H1 and alt present', async () => {
    const file = path.join(tmpDir, 'good.md');
    const content = '# Title\n\n![alt text](a.png)\n';
    await fs.writeFile(file, content, 'utf8');
    const results = await lintFiles([tmpDir + '/*.md']);
    const r = results.find(r => r.file.endsWith('good.md'));
    expect(r).to.exist;
    expect(r.messages).to.be.an('array').that.is.empty;
  });

  it('flags multiple H1 headings', async () => {
    const file = path.join(tmpDir, 'multi.md');
    const content = '# One\n\n# Two\n';
    await fs.writeFile(file, content, 'utf8');
    const results = await lintFiles([tmpDir + '/*.md']);
    const r = results.find(r => r.file.endsWith('multi.md'));
    expect(r).to.exist;
    expect(r.messages.some(m => /multiple h1/i.test(m.message) || /multiple h1 headings/i.test(m.message) || /multiple h1/i.test(m.message))).to.be.true;
  });

  it('empty file has no messages', async () => {
    const file = path.join(tmpDir, 'empty.md');
    await fs.writeFile(file, '', 'utf8');
    const results = await lintFiles([tmpDir + '/*.md']);
    const r = results.find(r => r.file.endsWith('empty.md'));
    expect(r).to.exist;
    expect(r.messages).to.be.an('array').that.is.empty;
  });

  it('runSpellcheck returns found:true for empty list and does not crash', async () => {
    const res = await runSpellcheck([]);
    expect(res).to.be.an('object');
    expect(res.found).to.equal(true);
    expect(res.problems).to.be.an('array');
  });

  it('detects HTML <img> missing alt attribute', async () => {
    const file = path.join(tmpDir, 'htmlimg.md');
    const content = '# Title\n\n<img src="a.png">\n';
    await fs.writeFile(file, content, 'utf8');
    const results = await lintFiles([tmpDir + '/*.md']);
    const r = results.find(r => r.file.endsWith('htmlimg.md'));
    expect(r).to.exist;
    expect(r.messages.some(m => m.message.toLowerCase().includes('html <img>'))).to.be.true;
  });

  it('handles reference-style images and flags empty alt', async () => {
    const file = path.join(tmpDir, 'ref.md');
    const content = '## Subtitle\n\n![][r]\n\n[r]: img.png\n';
    await fs.writeFile(file, content, 'utf8');
    const results = await lintFiles([tmpDir + '/*.md']);
    const r = results.find(r => r.file.endsWith('ref.md'));
    expect(r).to.exist;
    expect(r.messages.some(m => m.message.toLowerCase().includes('alt'))).to.be.true;
  });

  it('filters non-markdown files when using broad pattern', async () => {
    const md = path.join(tmpDir, 'only.md');
    const txt = path.join(tmpDir, 'skip.txt');
    await fs.writeFile(md, '# T\n', 'utf8');
    await fs.writeFile(txt, 'some text', 'utf8');
    const results = await lintFiles([tmpDir + '/*']);
    expect(results.every(r => r.file.endsWith('.md'))).to.be.true;
  });

  it('messages include location when available', async () => {
    const file = path.join(tmpDir, 'loc.md');
    const content = '## Subtitle\n\n![](a.png)\n';
    await fs.writeFile(file, content, 'utf8');
    const results = await lintFiles([tmpDir + '/*.md']);
    const r = results.find(r => r.file.endsWith('loc.md'));
    expect(r).to.exist;
    expect(r.messages.length).to.be.greaterThan(0);
    const m = r.messages.find(m => m.message.toLowerCase().includes('alt'));
    expect(m.location).to.be.ok;
    expect(m.location.start).to.have.property('line').that.is.a('number');
  });

  it('flags missing curriculum README sections', async () => {
    const file = path.join(tmpDir, 'README.md');
    const content = '# Lab\n\n## Overview\n\n## Instructions\n';
    await fs.writeFile(file, content, 'utf8');
    const results = await lintFiles([tmpDir + '/*.md']);
    const r = results.find(r => r.file.endsWith('README.md'));
    expect(r).to.exist;
    expect(r.messages.some(m => m.message.toLowerCase().includes('tools & resources'))).to.be.true;
    expect(r.messages.some(m => m.message.toLowerCase().includes('set up'))).to.be.true;
  });

  it('flags fenced code blocks without a language identifier', async () => {
    const file = path.join(tmpDir, 'nolanguage.md');
    const content = '# Title\n\n```\necho hello\n```\n';
    await fs.writeFile(file, content, 'utf8');
    const results = await lintFiles([tmpDir + '/*.md']);
    const r = results.find(r => r.file.endsWith('nolanguage.md'));
    expect(r).to.exist;
    expect(r.messages.some(m => m.message.toLowerCase().includes('language'))).to.be.true;
  });

  it('flags heading levels that jump unexpectedly', async () => {
    const file = path.join(tmpDir, 'jump.md');
    const content = '# Title\n\n### Subsection\n';
    await fs.writeFile(file, content, 'utf8');
    const results = await lintFiles([tmpDir + '/*.md']);
    const r = results.find(r => r.file.endsWith('jump.md'));
    expect(r).to.exist;
    expect(r.messages.some(m => m.message.toLowerCase().includes('heading level'))).to.be.true;
  });

  it('flags empty list items', async () => {
    const file = path.join(tmpDir, 'emptylist.md');
    const content = '# Title\n\n- \n';
    await fs.writeFile(file, content, 'utf8');
    const results = await lintFiles([tmpDir + '/*.md']);
    const r = results.find(r => r.file.endsWith('emptylist.md'));
    expect(r).to.exist;
    expect(r.messages.some(m => m.message.toLowerCase().includes('empty list item'))).to.be.true;
  });

  it('flags broken relative links', async () => {
    const file = path.join(tmpDir, 'links.md');
    const content = '# Title\n\n[missing](./missing.md)\n';
    await fs.writeFile(file, content, 'utf8');
    const results = await lintFiles([tmpDir + '/*.md']);
    const r = results.find(r => r.file.endsWith('links.md'));
    expect(r).to.exist;
    expect(r.messages.some(m => m.message.toLowerCase().includes('does not exist'))).to.be.true;
  });

  it('flags empty fenced code blocks', async () => {
    const file = path.join(tmpDir, 'emptycode.md');
    const content = '# Title\n\n```bash\n```\n';
    await fs.writeFile(file, content, 'utf8');
    const results = await lintFiles([tmpDir + '/*.md']);
    const r = results.find(r => r.file.endsWith('emptycode.md'));
    expect(r).to.exist;
    expect(r.messages.some(m => m.message.toLowerCase().includes('empty code block'))).to.be.true;
  });

  it('flags duplicate headings', async () => {
    const file = path.join(tmpDir, 'dupheadings.md');
    const content = '# Title\n\n## Overview\n\n## Overview\n';
    await fs.writeFile(file, content, 'utf8');
    const results = await lintFiles([tmpDir + '/*.md']);
    const r = results.find(r => r.file.endsWith('dupheadings.md'));
    expect(r).to.exist;
    expect(r.messages.some(m => m.message.toLowerCase().includes('duplicate heading'))).to.be.true;
  });

  it('allows disabling specific checks', async () => {
    const file = path.join(tmpDir, 'disabled-alt.md');
    const content = '## Subtitle\n\n![](img.png)\n';
    await fs.writeFile(file, content, 'utf8');
    const results = await lintFiles([tmpDir + '/*.md'], { disabledRules: ['alt-text'] });
    const r = results.find(r => r.file.endsWith('disabled-alt.md'));
    expect(r).to.exist;
    expect(r.messages.some(m => m.message.toLowerCase().includes('alt'))).to.be.false;
  });

  it('flags headings with no body content', async () => {
    const file = path.join(tmpDir, 'emptyheading.md');
    const content = '# Title\n\n## Next Step\n\n## Another Step\n';
    await fs.writeFile(file, content, 'utf8');
    const results = await lintFiles([tmpDir + '/*.md']);
    const r = results.find(r => r.file.endsWith('emptyheading.md'));
    expect(r).to.exist;
    expect(r.messages.some(m => m.message.toLowerCase().includes('no content'))).to.be.true;
  });
});
