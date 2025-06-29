const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  other: { type: Object, required: true, default: {} },

  cart: {
    type: [
      {
        id: String,
        quantity: { type: Number, default: 1 }
      }
    ],
    default: [] 
  },

  role: { type: String, required: true, default: "customer" }
});

module.exports = mongoose.model('SUser', userSchema);
