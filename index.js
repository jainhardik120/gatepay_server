const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();
const pool = require("./database.js");
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    "type": "service_account",
    "project_id": process.env.FIREBASE_PROJECT_ID,
    "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
    "private_key": process.env.FIREBASE_PRIVATE_KEY,
    "client_email": process.env.FIREBASE_CLIENT_EMAIL,
    "client_id": process.env.FIREBASE_CLIENT_ID,
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": process.env.FIREBASE_CLIENT_CERT_URL_X509,
    "universe_domain": "googleapis.com"
  })
});

const app = express();
app.use(bodyParser.json());
app.use(cors());

app.get("/", async (req, res, next) => {
  return res.json({ msg: "API Running" })
})

const authRouter = require("./routes/auth.routes.js")
const paymentRouter = require("./routes/payments.routes.js")
const parkingRouter = require("./routes/parking.routes.js")
const employeeAuthRouter = require("./routes/employee.auth.routes.js");
const vehicleRouter = require("./routes/vehicles.routes.js");

app.use('/api/auth', authRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/parking', parkingRouter);
app.use('/api/employee/auth', employeeAuthRouter);
app.use('/api/vehicle', vehicleRouter);


app.route("/sendmessage").post(async(req, res, next) => {
  try {
    const { token, notification } = req.body;

    // Create a message to send
    const message = {
      token: token, // The FCM token of the device you want to send the notification to
      notification: {
        title: notification.title,
        body: notification.body,
      },
    };

    const response = await admin.messaging().send(message);

    console.log("Successfully sent message:", response);

    res.status(200).json({ message: "Notification sent successfully" });
  } catch (error) {
    next(error);
  }
})


app.use((err, req, res, next) => {
  console.log(err);
  return res.status(err.status || 500).json({
    msg: err.message || "Internal Server Error"
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});