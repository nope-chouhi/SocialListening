const fs = require('fs');
const path = require('path');

const fixFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Boost contrast of gray text on light mode
  content = content.replace(/text-gray-500 dark:text-gray-400/g, 'text-gray-600 dark:text-gray-400');
  content = content.replace(/text-gray-500 dark:text-gray-500/g, 'text-gray-600 dark:text-gray-400');
  content = content.replace(/text-gray-400 dark:text-gray-500/g, 'text-gray-500 dark:text-gray-400');
  
  // Make cards look better in light mode (add shadow-sm, soften border)
  content = content.replace(/shadow border border-gray-200/g, 'shadow-sm border border-gray-100');
  
  // Change empty state icons to be a bit darker in light mode
  content = content.replace(/text-gray-400/g, 'text-gray-500 dark:text-gray-400');
  // Fix the double dark:text-gray-400 if it happened
  content = content.replace(/text-gray-500 dark:text-gray-500 dark:text-gray-400/g, 'text-gray-500 dark:text-gray-400');
  content = content.replace(/text-gray-500 dark:text-gray-400 dark:text-gray-400/g, 'text-gray-500 dark:text-gray-400');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed ${path.basename(filePath)}`);
  }
};

const dirs = [
  'frontend/src/app/dashboard/comparison/page.tsx',
  'frontend/src/app/dashboard/summary/page.tsx',
  'frontend/src/app/dashboard/overview/page.tsx',
];

dirs.forEach(f => {
  if (fs.existsSync(f)) {
    fixFile(f);
  }
});
