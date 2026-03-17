const fs = require('fs');
const path = require('path');

const directoryPath = 'src/app/(portal)';

const replacements = [
  { match: /\bbg-white\b/g, replace: 'bg-background-card' },
  { match: /\btext-gray-900\b/g, replace: 'text-foreground' },
  { match: /\btext-gray-800\b/g, replace: 'text-foreground' },
  { match: /\btext-gray-700\b/g, replace: 'text-foreground' },
  { match: /\btext-gray-600\b/g, replace: 'text-foreground-muted' },
  { match: /\btext-gray-500\b/g, replace: 'text-foreground-muted' },
  { match: /\btext-gray-400\b/g, replace: 'text-foreground-muted' },
  { match: /\bborder-gray-100\b/g, replace: 'border-border' },
  { match: /\bborder-gray-200\b/g, replace: 'border-border' },
  { match: /\bbg-gray-50\b/g, replace: 'bg-border/50' },
  { match: /\bbg-gray-100\b/g, replace: 'bg-border' },
  { match: /\bbg-gray-200\b/g, replace: 'bg-border' },
  { match: /\bshadow-sm\b/g, replace: 'shadow-sm shadow-black/5' },
];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let original = content;
      for (const { match, replace } of replacements) {
        content = content.replace(match, replace);
      }
      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Updated', fullPath);
      }
    }
  }
}

processDirectory(directoryPath);
console.log('Done');
