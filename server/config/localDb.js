const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILE = path.join(__dirname, '../../data/db.json');

// In-memory collection storage
const collections = {
  users: [],
  reports: [],
  teams: [],
  tasks: [],
  notifications: [],
  riskareas: [],
  hotspots: []
};

// Load existing data from file if exists
function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      if (raw.trim()) {
        const data = JSON.parse(raw);
        Object.keys(collections).forEach(col => {
          collections[col] = Array.isArray(data[col]) ? data[col] : [];
        });
      }
    }
  } catch (err) {
    console.warn('[LocalDB] Notice: Could not read existing db.json, initializing fresh store.', err.message);
  }
}

// Persist data to file
function saveDb() {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(collections, null, 2), 'utf8');
  } catch (err) {
    console.error('[LocalDB] Error saving db.json:', err.message);
  }
}

// Helper: check if a record matches query criteria
function matchesQuery(record, query) {
  if (!query || Object.keys(query).length === 0) return true;

  for (const key of Object.keys(query)) {
    if (key === '$or') {
      const orList = query['$or'];
      const matched = orList.some(subQuery => matchesQuery(record, subQuery));
      if (!matched) return false;
      continue;
    }
    if (key === '$and') {
      const andList = query['$and'];
      const matched = andList.every(subQuery => matchesQuery(record, subQuery));
      if (!matched) return false;
      continue;
    }

    const val = record[key];
    const condition = query[key];

    if (condition && typeof condition === 'object' && !(condition instanceof RegExp) && !(condition instanceof Date)) {
      if ('$in' in condition) {
        const inVals = condition['$in'].map(String);
        if (!inVals.includes(String(val))) return false;
      }
      if ('$nin' in condition) {
        const ninVals = condition['$nin'].map(String);
        if (ninVals.includes(String(val))) return false;
      }
      if ('$ne' in condition) {
        if (String(val) === String(condition['$ne'])) return false;
      }
      if ('$gte' in condition) {
        if (new Date(val) < new Date(condition['$gte'])) return false;
      }
      if ('$lte' in condition) {
        if (new Date(val) > new Date(condition['$lte'])) return false;
      }
      if ('$gt' in condition) {
        if (new Date(val) <= new Date(condition['$gt'])) return false;
      }
      if ('$lt' in condition) {
        if (new Date(val) >= new Date(condition['$lt'])) return false;
      }
      if ('$regex' in condition) {
        const flags = condition['$options'] || '';
        const reg = new RegExp(condition['$regex'], flags);
        if (!reg.test(String(val || ''))) return false;
      }
    } else if (condition instanceof RegExp) {
      if (!condition.test(String(val || ''))) return false;
    } else {
      if (String(val) !== String(condition)) return false;
    }
  }

  return true;
}

// Model wrapper class simulating Mongoose model interface
class LocalModel {
  constructor(collectionName, schemaDefinition = {}) {
    this.collectionName = collectionName.toLowerCase() + 's';
    if (!collections[this.collectionName]) {
      collections[this.collectionName] = [];
    }
    this.schemaDefinition = schemaDefinition;
  }

  _getItems() {
    return collections[this.collectionName] || [];
  }

  find(query = {}) {
    const items = this._getItems().filter(item => matchesQuery(item, query));
    return new QueryChain(items, this);
  }

  async findOne(query = {}) {
    const item = this._getItems().find(item => matchesQuery(item, query));
    return item ? this._wrapDoc(item) : null;
  }

  async findById(id) {
    if (!id) return null;
    const item = this._getItems().find(i => String(i._id) === String(id));
    return item ? this._wrapDoc(item) : null;
  }

  async countDocuments(query = {}) {
    return this._getItems().filter(item => matchesQuery(item, query)).length;
  }

  async create(data) {
    const now = new Date();
    const docData = {
      _id: data._id || crypto.randomBytes(12).toString('hex'),
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
      ...data
    };
    this._getItems().push(docData);
    saveDb();
    return this._wrapDoc(docData);
  }

  async insertMany(docs) {
    const created = [];
    for (const d of docs) {
      const doc = await this.create(d);
      created.push(doc);
    }
    return created;
  }

  async findByIdAndUpdate(id, update, options = {}) {
    const item = this._getItems().find(i => String(i._id) === String(id));
    if (!item) return null;

    let changes = update;
    if (update.$set) changes = { ...changes, ...update.$set };
    if (update.$inc) {
      for (const [k, v] of Object.entries(update.$inc)) {
        item[k] = (item[k] || 0) + v;
      }
    }
    if (update.$push) {
      for (const [k, v] of Object.entries(update.$push)) {
        if (!Array.isArray(item[k])) item[k] = [];
        item[k].push(v);
      }
    }

    delete changes.$set;
    delete changes.$inc;
    delete changes.$push;

    Object.assign(item, changes, { updatedAt: new Date() });
    saveDb();
    return this._wrapDoc(item);
  }

  async updateOne(query, update) {
    const item = this._getItems().find(i => matchesQuery(i, query));
    if (!item) return { matchedCount: 0, modifiedCount: 0 };
    await this.findByIdAndUpdate(item._id, update);
    return { matchedCount: 1, modifiedCount: 1 };
  }

  async updateMany(query, update) {
    const items = this._getItems().filter(i => matchesQuery(i, query));
    for (const item of items) {
      await this.findByIdAndUpdate(item._id, update);
    }
    return { matchedCount: items.length, modifiedCount: items.length };
  }

  async deleteOne(query) {
    const index = this._getItems().findIndex(i => matchesQuery(i, query));
    if (index !== -1) {
      this._getItems().splice(index, 1);
      saveDb();
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }

  async deleteMany(query = {}) {
    const initial = this._getItems().length;
    collections[this.collectionName] = this._getItems().filter(i => !matchesQuery(i, query));
    const deletedCount = initial - collections[this.collectionName].length;
    saveDb();
    return { deletedCount };
  }

  _wrapDoc(raw) {
    if (!raw) return null;
    const model = this;
    const doc = {
      ...raw,
      toObject: function() {
        const copy = { ...this };
        delete copy.toObject;
        delete copy.toJSON;
        delete copy.save;
        return copy;
      },
      toJSON: function() {
        const copy = { ...this };
        if (copy.password) delete copy.password;
        delete copy.toObject;
        delete copy.toJSON;
        delete copy.save;
        return copy;
      },
      save: async function() {
        this.updatedAt = new Date();
        const cleanDoc = { ...this };
        delete cleanDoc.toObject;
        delete cleanDoc.toJSON;
        delete cleanDoc.save;
        const index = model._getItems().findIndex(i => String(i._id) === String(this._id));
        if (index !== -1) {
          model._getItems()[index] = cleanDoc;
        } else {
          model._getItems().push(cleanDoc);
        }
        saveDb();
        return this;
      }
    };
    return doc;
  }
}

// Chainable query object to support .sort(), .limit(), .skip(), .populate(), .lean(), .select()
class QueryChain {
  constructor(items, model) {
    this._items = [...items];
    this._model = model;
  }

  sort(sortCriteria) {
    if (sortCriteria) {
      this._items.sort((a, b) => {
        if (typeof sortCriteria === 'string') {
          const isDesc = sortCriteria.startsWith('-');
          const field = isDesc ? sortCriteria.substring(1) : sortCriteria;
          const valA = a[field];
          const valB = b[field];
          if (valA < valB) return isDesc ? 1 : -1;
          if (valA > valB) return isDesc ? -1 : 1;
          return 0;
        } else if (typeof sortCriteria === 'object') {
          for (const [field, direction] of Object.entries(sortCriteria)) {
            const valA = a[field];
            const valB = b[field];
            if (valA < valB) return direction === -1 ? 1 : -1;
            if (valA > valB) return direction === -1 ? -1 : 1;
          }
          return 0;
        }
        return 0;
      });
    }
    return this;
  }

  skip(n) {
    this._items = this._items.slice(n);
    return this;
  }

  limit(n) {
    this._items = this._items.slice(0, n);
    return this;
  }

  populate() {
    return this;
  }

  select(fields) {
    return this;
  }

  lean() {
    return this;
  }

  async exec() {
    return this._items.map(item => this._model._wrapDoc(item));
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }
}

// Load database initially
loadDb();

module.exports = {
  LocalModel,
  loadDb,
  saveDb,
  collections
};
