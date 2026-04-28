const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
console.log('--- TESTE ENV ---');
console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('-----------------');
