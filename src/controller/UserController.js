const client = require('../config/db');
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const sendingMail = require("../utils/MailUtils")

const JWT_SECRET = 'MyStrongKey123!@#Secure';


exports.registerUser = async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    roleId,
    password,
  } = req.body;



  try {
    // Hash the password before saving
    const passwordhash = await bcrypt.hash(password, 10); // 10 = salt rounds

    const isAgreeTerms = true;
    await client.query(
  `CALL ins.sp_insert_user(
    $1::VARCHAR,
    $2::VARCHAR,
    $3::VARCHAR,
    $4::VARCHAR,
    $5::BOOLEAN,
    $6::SMALLINT,
    NULL,
    NULL
  )`,
  [firstName, lastName, email, passwordhash, isAgreeTerms, roleId]
);

     const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString(); // always 4 digits
};

// Step 2: Generate OTP
const otpCode = generateOTP();

// Step 3: Send Email with OTP
await sendingMail(
  email,
  "InflueSage OTP Verification",
  otpCode
);
    res.status(200).json({ message: 'User registration attempted.', data: passwordhash });

  } catch (error) {
    console.error('Register Error:', error);

    if (error.message.includes('already exists')) {
      res.status(400).json({ message: 'User with email and role already exists.' });
    } else {
      res.status(500).json({ message: 'Error registering user.' });
      console.error('Register Error:', error.message);

    }
  }
};

exports.loginUser = async (req, res) => {
  const { email, passwordhash } = req.body;

  try {
    const result = await client.query(
  'CALL ins.sp_login_user($1::VARCHAR, $2::VARCHAR, $3, $4)',
  [email, passwordhash, null, null]
);



    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    
    // Compare entered password with hashed password
    // const isMatch = await bcrypt.compare(password, passwordhash);
    // if (!isMatch) {
      //   return res.status(401).json({ message: "Incorrect password" });
      // }
      
      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '1h' }
      );
      
      console.log("Fetched user:", user);
      // Success response
      return res.status(200).json({
        message: "Login successful",
        
        token, // ← send to frontend
        id: user.id,
        name: user.firstname + " " + user.lastname, // Fix name
        email: user.email,
        role: user.role,
      });

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error during login" });
  }
};



