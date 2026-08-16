const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.js "your-password"');
  process.exit(1);
}

bcrypt.hash(password, 12).then((hash) => {
  // Base64-encoded: a raw bcrypt hash is full of literal "$" characters,
  // which Docker Compose's .env parser treats as variable-interpolation
  // syntax and silently corrupts. Base64 has no "$", so it survives
  // Compose's .env handling and plain dotenv loading identically.
  console.log(Buffer.from(hash).toString('base64'));
});
