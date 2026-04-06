const fs = require('fs');
const path = require('path');

const files = [
  'C:\\Users\\Admin\\.gemini\\antigravity\\scratch\\hustleup\\mobile\\app\\(tabs)\\index.js',
  'C:\\Users\\Admin\\.gemini\\antigravity\\scratch\\hustleup\\mobile\\app\\(tabs)\\messages.js',
  'C:\\Users\\Admin\\.gemini\\antigravity\\scratch\\hustleup\\mobile\\src\\components\\stories\\StoryViewer.js',
  'C:\\Users\\Admin\\.gemini\\antigravity\\scratch\\hustleup\\mobile\\src\\components\\stories\\StoryBar.js'
];

const oldColor = '#C6FF33';
const newColor = '#CDFF00';
let totalReplacements = 0;

files.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const regex = new RegExp(oldColor.replace(/#/g, '\\#'), 'g');
    const matches = content.match(regex);
    const replacementCount = matches ? matches.length : 0;
    
    const newContent = content.replace(regex, newColor);
    fs.writeFileSync(file, newContent, 'utf8');
    
    console.log(`✓ ${path.basename(file)}: ${replacementCount} replacement(s)`);
    totalReplacements += replacementCount;
  } catch (err) {
    console.error(`✗ ${path.basename(file)}: ${err.message}`);
  }
});

console.log(`\nTotal replacements: ${totalReplacements}`);
