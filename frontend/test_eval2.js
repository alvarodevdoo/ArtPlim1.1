import * as mathjs from 'mathjs';

console.log(mathjs.evaluate('(g / 1000)', { g: 5 }));
console.log(typeof mathjs.evaluate('(g / 1000)', { g: 5 }));
