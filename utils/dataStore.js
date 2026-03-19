const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function readJSON(filename) {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, filename), 'utf-8');
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

function writeJSON(filename, data) {
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = { readJSON, writeJSON };
