import { readFileSync } from 'node:fs';
const src = readFileSync('src/components/ProductCard.tsx', 'utf8');
const pi = src.indexOf('function ProductImage(');
const pc = src.indexOf('const ProductCard = memo');
console.log(src.slice(pi, pc));
console.log('---AREA---');
const area = src.indexOf('ref={imageAreaRef}');
console.log(src.slice(area-40, area+220));
