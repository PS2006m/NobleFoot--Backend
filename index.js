const express=require("express")
const app=express()
var mongoose = require('mongoose');
var path = require('path');
const { nanoid } = require('nanoid');
var session = require('express-session');
var bcrypt = require('bcrypt');
const cors = require('cors');
const SUsers=require('./models/SUsers')
const SProduct=require('./models/SProducts')
const fs = require('fs');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const PORT = process.env.PORT || 5000;
const MongoStore = require('connect-mongo');


app.use(cors({
  origin: 'https://noblefoot-frontend.onrender.com',
  credentials: true
}));

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config(); // Only load from .env in dev
}


const db_pass=process.env.DB_PASSWORD

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(`mongodb+srv://prathamshah485:${db_pass}@cluster0.ct3g8rx.mongodb.net/user?retryWrites=true&w=majority&appName=Cluster0`, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: `mongodb+srv://prathamshah485:${db_pass}@cluster0.ct3g8rx.mongodb.net/user?retryWrites=true&w=majority&appName=Cluster0`,
    collectionName: 'sessions'
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true only in production
    httpOnly: true,
    sameSite: 'none', // Required for cross-site cookies
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// 📥 Multer setup for single file upload
const upload = multer({ dest: 'uploads/' });


// 📌 Upload a single image
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'shoestore',
    });

    // Optional: Delete local file after upload
    fs.unlinkSync(req.file.path);

    res.json({ success: true, url: result.secure_url });
  } catch (err) {
    console.error('Upload failed:', err);
    res.status(500).json({ success: false, message: 'Image upload failed' });
  }
});


app.get('/logout',async(req,res)=>{
  req.session.destroy((err) =>{
    console.log(err)
  })
  res.json({msg:'Done'})
})

app.get("/",async(req,res)=>{
    res.json({msg:"Hello",success:true})
})

app.post('/signup',async(req,res)=>{
    const {email,password,name}=req.body
    const hashedPassword = await bcrypt.hash(password, 10);
    await SUsers.create({email,password:hashedPassword,name,other:{},cart:[],role:"customer"})
    res.json({msg:"User created",success:true})
})

async function uploadImage(img) {
  try {
    const result = await cloudinary.uploader.upload(img, {
      folder: 'shoestore',
    });
    console.log('Uploaded to Cloudinary:', result.secure_url);
    return result.secure_url
  } catch (err) {
    console.error('Upload error:', err);
    return err
  }
}

app.post('/add', upload.single('image'), async (req, res) => {
  try {
    // ✅ Session check
    if (!req.session.email) {
      return res.json({ msg: "Login first", success: false }); // RETURN!
    }

    const user = await SUsers.findOne({ email: req.session.email });

    if (!user || user.role !== "admin") {
      return res.json({ msg: "You are not admin", success: false }); // RETURN!
    }

    // ✅ Upload image to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'shoestore',
    });

    // ✅ Save product to MongoDB
    const id = nanoid(7);
    await SProduct.create({
      id,
      name: req.body.name,
      price: req.body.price,
      category: req.body.category,
      image: result.secure_url,
      desc: req.body.description,
    });

    fs.unlinkSync(req.file.path); // cleanup

    return res.json({ success: true, message: 'Product added!' }); // RETURN!
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Upload failed' }); // RETURN!
  }
});


app.get('/products', async (req, res) => {
  try {
    const products = await SProduct.find({});
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching products', error: err });
  }
});

app.post('/cart/add', async (req, res) => {
  const { productId } = req.body;
  const userEmail = req.session.email;

  if (!userEmail) {
    return res.status(401).json({ success: false, message: "Login required" });
  }

  try {
    const user = await SUsers.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.cart = user.cart || [];

    const index = user.cart.findIndex(item => item.id === productId.toString());

    if (index !== -1) {
      user.cart[index].quantity = (user.cart[index].quantity || 0) + 1;
    } else {
      user.cart.push({ id: productId.toString(), quantity: 1 });
    }

    await user.save();
    res.json({ success: true, message: "Product added to cart", cart: user.cart });
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({ success: false, message: "Server error", error });
  }
});
 
app.get('/cart', async (req, res) => {
  const userEmail = req.session.email;

  if (!userEmail) {
    return res.status(401).json({ message: "Not logged in" });
  }

  try {
    const user = await SUsers.findOne({ email: userEmail });
    if (!user || !user.cart || user.cart.length === 0) {
      return res.json([]);
    }

    const productIds = user.cart.map(item => item.id);
    const products = await SProduct.find({ _id: { $in: productIds } });

    const cartItems = user.cart.map(item => {
      const product = products.find(p => p._id.toString() === item.id);
      return product ? {
        ...product._doc,
        quantity: item.quantity
      } : null;
    }).filter(item => item !== null);

    res.json(cartItems);
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).json({ message: "Error fetching cart", error });
  }
});

// Reduce quantity
app.post('/cart/reduce', async (req, res) => {
  const { productId } = req.body;
  const userEmail = req.session.email;
  if (!userEmail) return res.status(401).json({ success: false, message: "Login required" });

  const user = await SUsers.findOne({ email: userEmail });
  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  const index = user.cart.findIndex(item => item.id === productId);
  if (index === -1) return res.status(404).json({ success: false, message: "Product not in cart" });

  if (user.cart[index].quantity > 1) {
    user.cart[index].quantity -= 1;
  } else {
    user.cart.splice(index, 1); // Remove item if quantity is 1
  }

  await user.save();
  res.json({ success: true, message: "Quantity reduced" });
});

// Delete product from cart
app.post('/cart/delete', async (req, res) => {
  const { productId } = req.body;
  const userEmail = req.session.email;
  if (!userEmail) return res.status(401).json({ success: false, message: "Login required" });

  const user = await SUsers.findOne({ email: userEmail });
  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  user.cart = user.cart.filter(item => item.id !== productId);
  await user.save();

  res.json({ success: true, message: "Item removed from cart" });
});

app.post('/cart/increase', async (req, res) => {
  const { productId } = req.body;
  const userEmail = req.session.email;
  if (!userEmail) return res.status(401).json({ success: false, message: "Login required" });

  const user = await SUsers.findOne({ email: userEmail });
  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  const index = user.cart.findIndex(item => item.id === productId);
  if (index === -1) return res.status(404).json({ success: false, message: "Product not in cart" });

  user.cart[index].quantity += 1;
  await user.save();

  res.json({ success: true, message: "Quantity increased" });
});


app.get('/products/:category', async (req, res) => {
  console.log("Reached in category")
  const { category } = req.params;
  try {
    console.log(category.charAt(0).toUpperCase() + category.slice(1).toLowerCase())
    const products = await SProduct.find({ category: category.charAt(0).toUpperCase() + category.slice(1).toLowerCase() });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: "Error fetching category products", error: err });
  }
});

app.get('/HP',async(req,res)=>{
  const product=await SProduct.find().limit(4)
  res.json(product)
})

app.get('/checkSession',async(req,res)=>{
  if(req.session.email){
    console.log(req.session.email)
    res.json({msg:"Found",success:true})
  }
  else{
    console.log(req.session.email)
    res.json({msg:"Not found",success:false})
  }
})

app.get('/checkAdmin',async(req,res)=>{
    const mail=req.session.email
    console.log(mail)
    const user=await SUsers.findOne({email:mail})
    console.log(user)
    if(user.role=="admin"){
        res.json({msg:"Correct",success:true})
    }
    else{
        res.json({msg:"Incorrect",success:false})
    }
})

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log("Reaches here")
    // Check if user exists
    const user = await SUsers.findOne({ email });
    console.log(user)
    if (!user) {
      return res.json({ msg: "User not found", success: false });
    }

    // Compare password
    const match = await bcrypt.compare(password, user.password);
    if (match) {
      req.session.email = email; // store email in session
      return res.json({ msg: "User logged in", success: true });
    } else {
      return res.json({ msg: "Wrong password", success: false });
    }
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ msg: "Server error during login", success: false });
  }
});


app.listen(PORT,()=>{
    console.log("Server listening")
})
