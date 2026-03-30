const fs = require('fs');
const path = require('path');

function processDir(dir) {
    fs.readdirSync(dir).forEach(file => {
        let fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.match(/\.jsx?$/)) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let original = content;

            // 1. Remove all gradient backgrounds
            content = content.replace(/bg-gradient-to-[a-z]+\s+from-[a-z]+-\d+\s+(via-[a-z]+-\d+\s+)?to-[a-z]+-\d+/g, 'bg-[#CDFF00]');
            content = content.replace(/bg-gradient-to-[a-z]+\s+from-surface-\d+\s+to-[a-z]+-\d+/g, 'bg-[#121212]');
            
            // 2. Map all purples, roses, indigos, ambers to #CDFF00 (or its shadow equivalent)
            // lime-400 is perfectly contrasting on dark mode
            content = content.replace(/(text|bg|border|shadow|ring)-purple-\d+/g, '$1-[#CDFF00]');
            content = content.replace(/(text|bg|border|shadow|ring)-rose-\d+/g, '$1-[#CDFF00]');
            content = content.replace(/(text|bg|border|shadow|ring)-indigo-\d+/g, '$1-[#CDFF00]');
            content = content.replace(/(text|bg|border|shadow|ring)-amber-\d+/g, '$1-[#CDFF00]');

            // 2.1 Replace shadow variations manually to avoid bad css definitions (since shadow-[#CDFF00] isn't a default text color, wait, tailwind supports arbitrary colors: shadow-[#CDFF00])
            // But arbitrary classes like text-[#CDFF00] are fine. 
            // wait text-purple-600 -> text-[#CDFF00] works perfectly in Tailwind JIT!

            // 3. Map light mode backgrounds to dark mode equivalents to guarantee contrast
            content = content.replace(/bg-white(\/\d+)?( backdrop-blur(?:-[a-z]+)?)?/g, 'glass bg-black/40 border border-white/10');
            content = content.replace(/bg-gray-50/g, 'bg-[#121212]');
            content = content.replace(/bg-gray-100/g, 'bg-[#1E1E1E]');
            content = content.replace(/bg-gray-200/g, 'bg-white/10');
            
            content = content.replace(/border-gray-100/g, 'border-white/5');
            content = content.replace(/border-gray-200/g, 'border-white/10');

            // 4. Map light mode text to dark mode text to guarantee contrast
            content = content.replace(/text-gray-900/g, 'text-white');
            content = content.replace(/text-gray-800/g, 'text-gray-200');
            content = content.replace(/text-gray-700/g, 'text-gray-300');
            
            // 5. specific fix for text-[#CDFF00] on bg-[#CDFF00] which is invisible
            content = content.replace(/bg-\[#CDFF00\] text-\[#CDFF00\]/g, 'bg-[#CDFF00] text-black');
            
            if (original !== content) {
                fs.writeFileSync(fullPath, content);
                console.log('Updated ' + fullPath);
            }
        }
    });
}

processDir(path.join(__dirname, 'src'));
