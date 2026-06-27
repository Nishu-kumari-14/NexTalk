const express = require("express");

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

const User = require("../models/User");

const router = express.Router();


const JWT_SECRET = process.env.JWT_SECRET; 



router.post("/signup", async (req, res) => {

  try {

    const { username, password } = req.body;

    // Check existing user
    const existingUser = await User.findOne({ username });

    if (existingUser) {
      return res.status(400).json({
        error: "Username already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      username,
      password: hashedPassword,
    });

    res.json({
      message: "User created",
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: "Signup failed",
    });
  }
});




router.post("/login", async (req, res) => {

  try {

    const { username, password } = req.body;

    // Find user
    const user = await User.findOne({ username });

    

    if (!user) {
      return res.status(400).json({
        error: "Invalid credentials",
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

   

    if (!isMatch) {
     
      return res.status(400).json({
        error: "Invalid credentials",
      });
    }

    // Create JWT
    
    const token = jwt.sign(
      {
        userId: user._id,
        username: user.username,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: "Login failed",
    });
  }
});


module.exports = router;