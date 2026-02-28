import express from "express"
import cors from "cors"
import dotenv from "dotenv"
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(cors())

app.use("/", (req, res) => {
    res.json({ success: true, message: "Server is healthy" })
})

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))