import express from "express"
import { auth } from "../middleware/auth.js"
import { GenerateArticle, GenerateBlogTitle, GenerateImage, RemoveImageBackground, RemoveImageObject, ResumeReview } from "../controllers/aiController.js"
import { upload } from "../configs/multer.js"

const aiRouter = express.Router()


aiRouter.post("/generate-article", auth, GenerateArticle)
aiRouter.post("/generate-blog", auth, GenerateBlogTitle)
aiRouter.post("/generate-image", auth, GenerateImage)
aiRouter.post("/remove-image-background", auth, upload.single('image'), RemoveImageBackground)
aiRouter.post("/remove-image-object", auth, upload.single('image'), RemoveImageObject)
aiRouter.post("/resume-review", auth, upload.single('resume'), ResumeReview)

export default aiRouter