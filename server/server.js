import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import pgsql from "./configs/db.js"
import { clerkMiddleware, requireAuth } from "@clerk/express"
import aiRouter from "./routes/aiRoutes.js"
import connectCloudinary from "./configs/cloudinary.js"
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

await connectCloudinary()
// middlewares
app.use(express.json())
app.use(cors())
app.use(clerkMiddleware())
app.use(requireAuth())

app.use("/api/ai", aiRouter)
app.use("/", (req, res) => {
    res.json({ success: true, message: "Server is healthy" })
})



app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))