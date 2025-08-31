import express from "express"
import cors from "cors"
import "./src/config/db.config.js"
import home from "./src/routes/home.js";
const app = express();
const port = 3010;

app.use(express.json());
app.use(cors())
app.use("/api", home)

app.get("/", (req, res) => {
  res.send("Hello World");
})

app.listen(port, () => {
  console.log("Running on port " + port)
})