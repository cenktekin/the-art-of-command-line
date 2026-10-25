#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'archive']);

const SECRET_PATTERNS = [
  { name: 'windows absolute path', re: /\b[A-Za-z]:[\\/](?:Users|projects|Windows|Program Files)\b/ },
  { name: 'unix home path', re: /\/home\/[A-Za-z0-9._-]+\// },
  { name: 'macos home path', re: /\/Users\/[A-Za-z0-9._-]+\// },
  // Split literals so the scanner does not flag its own source.
  { name: 'local note-app reference', re: new RegExp('\\bjop' + 'lin\\b|\\bnote_' + 'id\\b', 'i') },
  { name: 'github token', re: /\b(?:ghp|gho|ghs|ghu)_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}/ },
  { name: 'google api key', re: /\bAIza[0-9A-Za-z_-]{30,}/ },
  { name: 'openai-style key', re: /\bsk-[A-Za-z0-9_-]{20,}/ },
  { name: 'aws access key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

const LINK_RE = /!?\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
const REF_DEF_RE = /^\s{0,3}\[[^\]]+\]:\s*(\S+)/gm;

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), out);
    } else if (entry.isFile()) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function trackedFiles() {
  try {
    const out = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' });
    return out.split('\0').filter(Boolean).map((entry) => path.join(ROOT, entry));
  } catch {
    return walk(ROOT, []);
  }
}

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function isExternal(target) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target) || target === '';
}

function stripSuffix(target) {
  return target.split('#')[0].split('?')[0];
}

function existsCaseExact(absolute) {
  const parts = path.relative(ROOT, absolute).split(path.sep);
  if (parts.length === 0 || parts[0] === '..') return false;

  let current = ROOT;
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    let entries;
    try {
      entries = fs.readdirSync(current);
    } catch {
      return false;
    }
    if (!entries.includes(part)) return false;
    current = path.join(current, part);
  }
  return fs.existsSync(current);
}

function checkEncoding(file, errors) {
  const buffer = fs.readFileSync(file);
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    errors.push(`${rel(file)}: UTF-8 BOM present`);
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    errors.push(`${rel(file)}: not valid UTF-8`);
  }
  return buffer.toString('utf8');
}

function checkFences(file, text, errors) {
  let open = null;
  text.split(/\r?\n/).forEach((line, index) => {
    const match = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (!match) return;
    const marker = match[1][0];
    if (open === null) {
      open = marker;
    } else if (open === marker) {
      open = null;
    }
    if (open === null && match[1].length < 3) {
      errors.push(`${rel(file)}:${index + 1}: malformed code fence`);
    }
  });
  if (open !== null) {
    errors.push(`${rel(file)}: unbalanced code fence (missing closing \`\`\`)`);
  }
}

function checkLinks(file, text, errors) {
  const targets = [];
  for (const match of text.matchAll(LINK_RE)) targets.push(match[1]);
  for (const match of text.matchAll(REF_DEF_RE)) targets.push(match[1]);

  for (const raw of targets) {
    const target = stripSuffix(raw);
    if (isExternal(target)) continue;

    let decoded = target;
    try {
      decoded = decodeURIComponent(target);
    } catch {
      errors.push(`${rel(file)}: malformed percent-encoding in link "${raw}"`);
      continue;
    }

    const resolved = decoded.startsWith('/')
      ? path.join(ROOT, decoded)
      : path.join(path.dirname(file), decoded);

    if (!existsCaseExact(resolved)) {
      errors.push(`${rel(file)}: broken relative link "${raw}"`);
    }
  }
}

function checkSecrets(file, text, errors) {
  const lines = text.split(/\r?\n/);
  SECRET_PATTERNS.forEach(({ name, re }) => {
    lines.forEach((line, index) => {
      if (re.test(line)) {
        errors.push(`${rel(file)}:${index + 1}: ${name} — "${line.trim().slice(0, 80)}"`);
      }
    });
  });
}

function main() {
  const errors = [];
  const files = trackedFiles().filter((file) => file.endsWith('.md'));
  const scanned = trackedFiles().filter((file) => !/\.(png|jpe?g|gif|webp|ico|pdf)$/i.test(file));

  for (const file of scanned) {
    const text = checkEncoding(file, errors);
    checkSecrets(file, text, errors);
  }

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    checkFences(file, text, errors);
    checkLinks(file, text, errors);
  }

  if (errors.length > 0) {
    console.error(`FAIL — ${errors.length} problem(s):`);
    errors.forEach((error) => console.error(`  • ${error}`));
    process.exit(1);
  }

  console.log(`OK — ${scanned.length} files scanned, ${files.length} markdown files checked, 0 problems.`);
}

main();
