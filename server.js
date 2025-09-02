import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import deadlinesRoute from "./routes/deadlines.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

//app.use(cors());
//
//app.use(cors({ origin: "*" }));

app.use(cors({
  origin: ["http://127.0.0.1:5500", "http://localhost:5500"],  // Live Server origins
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));




app.use(express.json());

// Routes
app.use("/api/deadlines", deadlinesRoute);

// app.get("/", (req, res) => {
//   res.send("Backend is running ");
// });

app.listen(PORT, "127.0.0.1", () => {
  console.log(`✅ Server running on http://127.0.0.1:${PORT}`);
});


