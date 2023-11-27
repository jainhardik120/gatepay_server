const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

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
const pointRouter = require("./routes/points.routes.js")

app.use('/api/auth', authRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/parking', parkingRouter);
app.use('/api/employee/auth', employeeAuthRouter);
app.use('/api/vehicle', vehicleRouter);
app.use("/api/point", pointRouter);


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