import { readFileSync } from 'fs';

const src = readFileSync('src/components/admin/ProductBatchesDialog.tsx', 'utf8');
const lines = src.split('\n');

// find DialogContent tag and print surrounding context
const idx = lines.findIndex(l => l.includes('<DialogContent'));
console.log('DialogContent line', idx + 1, '=>', lines[idx]);
console.log('previous', lines[idx - 1]);
console.log('next', lines[idx + 1]);
