import { makeAxis } from '../src/engine/axis.js';
import { makeRebaser } from '../src/engine/rebase.js';

const a = makeAxis({ kind: 'log', from: 0, to: 27, unit: 'm', label: 'from your feet' });
const checks = [
  ['u=0 -> 1 m', a.toValue(0), 1],
  ['u=1 -> 1e27 m', a.toValue(1), 1e27],
  ['roundtrip earth radius', a.toU(6.371e6), (Math.log10(6.371e6)) / 27],
  ['roundtrip 1 AU', a.toValue(a.toU(1.496e11)), 1.496e11],
];
for (const [name, got, want] of checks) {
  const ok = Math.abs(got - want) <= Math.abs(want) * 1e-9;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${got}`);
}
console.log('format @u=0   ', a.format(0));
console.log('format @u=0.4 ', a.format(0.4));
console.log('format @u=1   ', a.format(1));

const r = makeRebaser();
r.setScale(1.496e11 / 4);           // framing 1 AU
console.log('\nat 1 AU scale:');
console.log('  earth (1.27e7 m) visible?', r.visible(1.27e7), 'weight', r.weight(1.27e7).toFixed(3));
console.log('  1 AU   (1.5e11 m) visible?', r.visible(1.496e11), 'weight', r.weight(1.496e11).toFixed(3));
console.log('  galaxy (1e21 m)  visible?', r.visible(1e21));
console.log('  toWorld(1 AU) =', r.toWorld(1.496e11), 'units');
r.setScale(1e21);
console.log('at galaxy scale: earth visible?', r.visible(1.27e7), '| galaxy visible?', r.visible(1e21));
