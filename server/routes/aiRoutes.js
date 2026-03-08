import express from "express"
import { auth } from "../middleware/auth.js"
import { askaboutResume, GenerateArticle, GenerateBlogTitle, GenerateImage, RemoveImageBackground, RemoveImageObject, ResumeReview, ReviewResume } from "../controllers/aiController.js"
import { upload } from "../configs/multer.js"

const aiRouter = express.Router()


aiRouter.post("/generate-article", auth, GenerateArticle)
aiRouter.post("/generate-blog", auth, GenerateBlogTitle)
aiRouter.post("/generate-image", auth, GenerateImage)
aiRouter.post("/remove-image-background", auth, upload.single('image'), RemoveImageBackground)
aiRouter.post("/remove-image-object", auth, upload.single('image'), RemoveImageObject)
aiRouter.post("/resume-review", auth, upload.single('resume'), ResumeReview)
aiRouter.post("/resume", auth, upload.single('resume'), ReviewResume)
aiRouter.post("/askabout", auth, askaboutResume)

export default aiRouter