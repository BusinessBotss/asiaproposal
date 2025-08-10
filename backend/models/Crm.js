const mongoose = require('mongoose');

const CrmSchema = new mongoose.Schema({
  location: { type: String, required: true },
  role: { type: String, required: true },
  name: { type: String },
  address: { type: String },
  workers: [
    {
      name: String,
      phone: String,
      email: String,
    },
  ],
});

module.exports = mongoose.model('Crm', CrmSchema);