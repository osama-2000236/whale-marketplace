/**
 * DataStore - JSON file-based data storage
 * Handles reading, writing, and CRUD operations for all data files.
 * 
 * Usage:
 *   const store = new DataStore('products');
 *   const all = store.getAll();
 *   store.create({ name: 'New Product', price: 100 });
 *   store.update('id-123', { price: 200 });
 *   store.delete('id-123');
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '..', 'data');

class DataStore {
  constructor(collection) {
    this.collection = collection;
    this.filePath = path.join(DATA_DIR, `${collection}.json`);
    this._ensureFile();
  }

  // Ensure the data file exists
  _ensureFile() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2));
    }
  }

  // Read all records
  _read() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      console.error(`Error reading ${this.collection}:`, err.message);
      return [];
    }
  }

  // Write all records
  _write(data) {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (err) {
      console.error(`Error writing ${this.collection}:`, err.message);
      return false;
    }
  }

  // Get all records (optional filter)
  getAll(filter = null) {
    let data = this._read();
    if (filter && typeof filter === 'function') {
      data = data.filter(filter);
    }
    return data;
  }

  // Get record by ID
  getById(id) {
    const data = this._read();
    return data.find(item => item.id === id) || null;
  }

  // Get records by field value
  getBy(field, value) {
    const data = this._read();
    return data.filter(item => item[field] === value);
  }

  // Search records (searches in specified fields)
  search(query, fields = ['name', 'description']) {
    const data = this._read();
    const q = query.toLowerCase();
    return data.filter(item =>
      fields.some(field =>
        item[field] && item[field].toString().toLowerCase().includes(q)
      )
    );
  }

  // Create a new record
  create(record) {
    const data = this._read();
    const newRecord = {
      id: uuidv4(),
      ...record,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.push(newRecord);
    this._write(data);
    return newRecord;
  }

  // Update a record by ID
  update(id, updates) {
    const data = this._read();
    const index = data.findIndex(item => item.id === id);
    if (index === -1) return null;

    data[index] = {
      ...data[index],
      ...updates,
      id: data[index].id, // Prevent ID change
      createdAt: data[index].createdAt, // Preserve creation date
      updatedAt: new Date().toISOString()
    };
    this._write(data);
    return data[index];
  }

  // Delete a record by ID
  delete(id) {
    const data = this._read();
    const index = data.findIndex(item => item.id === id);
    if (index === -1) return false;

    const deleted = data.splice(index, 1)[0];
    this._write(data);
    return deleted;
  }

  // Count records (optional filter)
  count(filter = null) {
    return this.getAll(filter).length;
  }

  // Get paginated results
  paginate(page = 1, limit = 12, filter = null, sort = null) {
    let data = this.getAll(filter);

    // Sort
    if (sort) {
      const { field, order } = sort;
      data.sort((a, b) => {
        if (order === 'desc') return a[field] > b[field] ? -1 : 1;
        return a[field] > b[field] ? 1 : -1;
      });
    }

    const total = data.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const items = data.slice(offset, offset + limit);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  // Reorder items (for manual sorting)
  reorder(orderedIds) {
    const data = this._read();
    const reordered = [];
    orderedIds.forEach((id, index) => {
      const item = data.find(d => d.id === id);
      if (item) {
        item.sortOrder = index;
        reordered.push(item);
      }
    });
    // Add any items not in the ordered list at the end
    data.forEach(item => {
      if (!orderedIds.includes(item.id)) {
        reordered.push(item);
      }
    });
    this._write(reordered);
    return reordered;
  }
}

module.exports = DataStore;
