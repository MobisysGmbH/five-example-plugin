const fs = require('node:fs/promises');
const path = require('node:path');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');

const mainDir = path.resolve(__dirname, '..');
const distDir = path.join(__dirname, '..', 'dist');
const privateKeyPath = path.join(mainDir, 'developer_private.jwk');
const publicKeyPath = path.join(mainDir, 'developer_public.jwk');
const pluginJSPath = path.join(distDir, 'plugin.js');

// trigger webpack
childProcess.execSync('npx webpack', { cwd: mainDir, stdio: 'inherit', shell: true });

return (async function main() {
  const subtle = crypto.subtle;
  const projectMetadata = JSON.parse(await fs.readFile(path.join(mainDir, 'package.json'), 'utf8'));

  let privateKey;

  // (opt) create developer key
  if (!(await fs.stat(privateKeyPath)).isFile()) {
    const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-384' }, true, ['sign', 'verify']);
    privateKey = kp.privateKey;
    
    const exportedPrivateKey = await subtle.exportKey('jwk', privateKey);
    const exportedPublicKey = await subtle.exportKey('jwk', kp.publicKey);
    
    await fs.writeFile(publicKeyPath, JSON.stringify(exportedPublicKey, null, 2), 'utf8');
    await fs.writeFile(privateKeyPath, JSON.stringify(exportedPrivateKey, null, 2), 'utf8');
  } else {
    const privateJWK = await fs.readFile(privateKeyPath, 'utf8');
    const parsedJWK = JSON.parse(privateJWK);
    privateKey = await crypto.subtle.importKey('jwk', parsedJWK, { name: 'ECDSA', namedCurve: 'P-384' }, false, ['sign']);
  }
  
  // read the plugin content
  const content = await fs.readFile(pluginJSPath);
  
  // calculate signature
  const signature = await subtle.sign({ name: 'ECDSA', hash: 'SHA-384' }, privateKey, content);
  const signatureBuffer = Buffer.from(signature);

  const publicKey = await fs.readFile(publicKeyPath, 'utf8');
  const parsedPublicKey = JSON.parse(publicKey);
  
  // create metadata
  const metadata = {
    id: projectMetadata.id,
    name: projectMetadata.name,
    description: projectMetadata.description,
    version: projectMetadata.version,
    publicKey: parsedPublicKey,
    type: 'plugin',
    signature: signatureBuffer.toString('base64')
  };
  
  // write metadata
  await fs.writeFile(path.join(distDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');
})();
