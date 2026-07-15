const crypto = require('node:crypto');
const readline = require('node:readline/promises');

async function main() {
  const password = process.argv[2] || await askPassword();
  if (!password || password.length < 10) {
    console.error('Usa una contraseña de al menos 10 caracteres.');
    process.exit(1);
  }

  const salt = crypto.randomBytes(16).toString('base64url');
  const iterations = 210000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('base64url');
  console.log(`pbkdf2-sha256:${iterations}:${salt}:${hash}`);
}

async function askPassword() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const password = await rl.question('Contraseña admin: ');
  rl.close();
  return password;
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
