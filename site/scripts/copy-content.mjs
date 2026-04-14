#!/usr/bin/env node
/**
 * Prebuild script: copies markdown content from the repo root directories
 * into site/src/content/docs/ where Astro/Starlight can pick them up.
 *
 * Transformations:
 *   analysis/ANALYSIS-{slug}.md        → docs/analysis/{slug}.md
 *   benchmarks/sources/{slug}-repro.md → docs/benchmarks/{slug}.md
 *   references/{slug}.md               → docs/references/{slug}.md
 *   ANALYSIS.md                        → docs/synthesis.md  (frontmatter injected)
 *   REVIEWED.md                        → docs/triage-log.md (frontmatter injected)
 *
 * The `slug:` frontmatter key is stripped during copy. Starlight (via Astro's
 * glob loader) uses `slug` as the entry ID override, causing duplicate-ID
 * collisions when analysis/ and benchmarks/ share the same slug values.
 * Without `slug`, IDs are derived from the full file path (analysis/context-mode,
 * benchmarks/context-mode, etc.) which are unique.
 */

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const SITE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO_ROOT = dirname(SITE_ROOT);
const DOCS_ROOT = join(SITE_ROOT, 'src', 'content', 'docs');

/** Clear and recreate a directory. */
function resetDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

/**
 * Remove the `slug:` key from YAML frontmatter so Astro/Starlight derives
 * the entry ID from the file path instead, avoiding cross-collection collisions.
 */
function stripSlug(content) {
  if (!content.startsWith('---')) return content;
  const closeIdx = content.indexOf('\n---', 3);
  if (closeIdx === -1) return content;
  const fmBody = content.slice(3, closeIdx);
  const stripped = fmBody.replace(/\nslug:[ \t]*[^\n]*/g, '');
  return '---' + stripped + content.slice(closeIdx);
}

/**
 * If the content does not already have YAML frontmatter, prepend a minimal
 * block with title so Starlight can render the page.
 */
function ensureFrontmatter(content, title) {
  if (content.trimStart().startsWith('---')) return stripSlug(content);
  return `---\ntitle: "${title.replace(/"/g, '\\"')}"\n---\n\n${content}`;
}

/**
 * Rewrite repo-relative markdown links to site-absolute URLs so they resolve
 * correctly when the document is published to /agentic-context/.
 *
 * Handles:
 *   analysis/ANALYSIS-{slug}.md   → /agentic-context/analysis/{slug}/
 *   benchmarks/sources/{slug}-repro.md → /agentic-context/benchmarks/{slug}/
 */
function rewriteLinks(content) {
  return content
    .replace(/\(analysis\/ANALYSIS-([^)]+)\.md\)/g, '(/agentic-context/analysis/$1/)')
    .replace(/\(benchmarks\/sources\/([^)]+)-repro\.md\)/g, '(/agentic-context/benchmarks/$1/)');
}

function copyMd(srcPath, destPath) {
  const raw = readFileSync(srcPath, 'utf8');
  writeFileSync(destPath, stripSlug(raw));
}

// ── analysis/ANALYSIS-*.md → docs/analysis/{slug}.md ─────────────────────────
const analysisDocsDir = join(DOCS_ROOT, 'analysis');
resetDir(analysisDocsDir);
for (const file of readdirSync(join(REPO_ROOT, 'analysis'))) {
  if (!file.startsWith('ANALYSIS-') || !file.endsWith('.md')) continue;
  const slug = file.slice('ANALYSIS-'.length, -'.md'.length);
  copyMd(join(REPO_ROOT, 'analysis', file), join(analysisDocsDir, `${slug}.md`));
}

// ── benchmarks/sources/*.md → docs/benchmarks/{slug}.md ──────────────────────
const benchmarksDocsDir = join(DOCS_ROOT, 'benchmarks');
resetDir(benchmarksDocsDir);
for (const file of readdirSync(join(REPO_ROOT, 'benchmarks', 'sources'))) {
  if (!file.endsWith('.md')) continue;
  const slug = file.endsWith('-repro.md')
    ? file.slice(0, -'-repro.md'.length)
    : file.slice(0, -'.md'.length);
  copyMd(join(REPO_ROOT, 'benchmarks', 'sources', file), join(benchmarksDocsDir, `${slug}.md`));
}

// ── references/*.md (top-level only, skip INDEX) → docs/references/{slug}.md ─
const refsDocsDir = join(DOCS_ROOT, 'references');
resetDir(refsDocsDir);
const SKIP_REFS = new Set(['REFERENCE_INDEX.md']);
for (const file of readdirSync(join(REPO_ROOT, 'references'))) {
  if (!file.endsWith('.md') || SKIP_REFS.has(file)) continue;
  copyMd(join(REPO_ROOT, 'references', file), join(refsDocsDir, file));
}

// ── ANALYSIS.md → docs/synthesis.md ─────────────────────────────────────────
// tableOfContents: false removes the right-side ToC column so the wide
// comparison matrix can use the full available viewport width.
const synthesisRaw = rewriteLinks(readFileSync(join(REPO_ROOT, 'ANALYSIS.md'), 'utf8'));
const synthesisFm = `---\ntitle: "Context Management — Cross-Tool Synthesis"\ntableOfContents: false\n---\n\n`;
const synthesisBody = synthesisRaw.trimStart().startsWith('---')
  ? synthesisRaw  // already has frontmatter — leave it (shouldn't happen for ANALYSIS.md)
  : synthesisFm + synthesisRaw;
writeFileSync(join(DOCS_ROOT, 'synthesis.md'), synthesisBody);

// ── REVIEWED.md → docs/triage-log.md ─────────────────────────────────────────
const triageContent = readFileSync(join(REPO_ROOT, 'REVIEWED.md'), 'utf8');
writeFileSync(
  join(DOCS_ROOT, 'triage-log.md'),
  ensureFrontmatter(triageContent, 'Triage Log'),
);

console.log('✓ Content copied to src/content/docs/');
