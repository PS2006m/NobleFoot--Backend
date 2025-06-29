const mongoose = require('mongoose');

const proSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  price:{type:Number,required:true},
  category:{type:String,required:true,enum:['Kids','Men','Women']},
  image:{type:String,required:true},
  desc:{type:String,required:true}
});

module.exports = mongoose.model('SProduct', proSchema);
