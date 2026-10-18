const mongoose = require('mongoose');

/**
 * Model factory returning standard Mongoose models.
 * Pure real MongoDB integration with no silent mock fallback.
 */
function createDualModel(modelName, mongooseSchema) {
  return mongoose.models[modelName] || mongoose.model(modelName, mongooseSchema);
}

module.exports = {
  createDualModel
};
