import express from "express"
import { auth } from "../middleware/auth.js"
import { GenerateArticle, GenerateBlogTitle, GenerateImage } from "../controllers/aiController.js"

const aiRouter = express.Router()


aiRouter.post("/generate-article", auth, GenerateArticle)
aiRouter.post("/generate-blog", auth, GenerateBlogTitle)
aiRouter.post("/generate-image", auth, GenerateImage)

export default aiRouter