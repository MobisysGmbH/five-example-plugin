const fs = require('node:fs');
const path = require('node:path');

const MAIN_PATH = path.resolve(__dirname, '..');
const DIST_PATH = path.join(MAIN_PATH, 'dist');

const JSZip = require('jszip');

const pkg = new JSZip();
const ws = fs.createWriteStream(path.join(DIST_PATH, 'plugin.fiveplugin'), { autoClose: true, autoEmit: true, encoding: 'binary' });

return new Promise((resolve, reject) => {
  pkg
    .file('plugin.js', fs.readFileSync(path.join(DIST_PATH, 'plugin.js')))
    .file('metadata.json', fs.readFileSync(path.join(DIST_PATH, 'metadata.json')))
    .generateNodeStream({ compression: 'DEFLATE', compressionOptions: { level: 9 }})
    .pipe(ws)
    .on('close', resolve)
    .once('error', reject);
});
