import { clerkClient } from "@clerk/express"
import pgsql from "../configs/db.js"
import openai from "../configs/gemini.js"
import axios from "axios"
import { v2 as cloudinary } from "cloudinary"
import { configDotenv } from "dotenv"
import fs from "fs"
import { PDFParse } from "pdf-parse"
configDotenv()

export const GenerateArticle = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { prompt, length } = req.body
        const plan = req.plan
        const free_usage = req.free_usage

        if (!prompt || !length) {
            return res.status(400).json({ success: false, message: "Need prompt and length to generate article" })
        }

        if (!plan !== "premium" && free_usage >= 10) {
            return res.json({ success: false, message: "Your have used your credits, Please upgrade to premium plan to continue" })
        }

        const response = await openai.chat.completions.create({
            model: "gemini-3-flash-preview",
            messages: [
                {
                    role: "user", content: prompt,
                }
            ],
            temperature: 0.7,
            max_tokens: length
        })

        const content = response.choices[0].message.content

        const query = await pgsql`INSERT INTO creations (user_id, prompt, content, type) VALUES (${userId}, ${prompt}, ${content}, 'article')`

        if (plan !== "premium") {
            await clerkClient.users.updateUserMetadata(userId, {
                privateMetadata: {
                    free_usage: free_usage + 1
                }
            })
        }

        return res.status(200).json({ success: true, content })


    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, message: error.message })
    }
}
export const GenerateBlogTitle = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { prompt } = req.body
        const plan = req.plan
        const free_usage = req.free_usage

        if (!prompt) {
            return res.status(400).json({ success: false, message: "Need prompt to generate blog-title" })
        }

        if (!plan !== "premium" && free_usage >= 10) {
            return res.json({ success: false, message: "Your have used your credits, Please upgrade to premium plan to continue" })
        }

        const response = await openai.chat.completions.create({
            model: "gemini-3-flash-preview",
            messages: [{
                role: "user", content: prompt,
            }
            ],
            temperature: 0.7,
            max_tokens: 500
        })

        const content = response.choices[0].message.content

        const query = await pgsql`INSERT INTO creations (user_id, prompt, content, type) VALUES (${userId}, ${prompt}, ${content}, 'blog-title')`

        if (plan !== "premium") {
            await clerkClient.users.updateUserMetadata(userId, {
                privateMetadata: {
                    free_usage: free_usage + 1
                }
            })
        }

        return res.status(200).json({ success: true, content })

    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, message: error.message })
    }
}
export const GenerateImage = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { prompt, publish } = req.body
        const plan = req.plan


        if (!prompt) {
            return res.status(400).json({ success: false, message: "Need prompt and publish to generate image" })
        }

        const formData = new FormData()
        formData.append('prompt', prompt)

        const apiKey = process.env.CLIPDROP_API_KEY

        if (apiKey) {
            const response = await axios.post('https://clipdrop-api.co/text-to-image/v1', formData, {
                headers: {
                    'x-api-key': apiKey,
                },
                responseType: "arraybuffer"
            })
            const base64image = `data:image/png;base64,${Buffer.from(response.data, "binary").toString("base64")}`

            const { secure_url } = await cloudinary.uploader.upload(base64image)



            const query = await pgsql`INSERT INTO creations (user_id, prompt, content, type, publish) VALUES (${userId}, ${prompt}, ${secure_url}, 'image', ${publish ?? false})`



            return res.status(200).json({ success: true, content: secure_url })
        } else {
            return res.json({ sucess: false, message: "Api key not provided" })
        }

    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, message: error.message })
    }
}
export const RemoveImageBackground = async (req, res) => {
    try {
        const { userId } = req.auth()
        const image = req.file
        const plan = req.plan
        console.log(image)

        if (!image) {
            return res.status(400).json({ success: false, message: "Need image to generate background" })
        }



        const { secure_url } = await cloudinary.uploader.upload(image.path, {
            transformation: [
                {
                    effect: "background_removal",
                    background_removal: "remove_the_background"
                }
            ]
        })

        const query = await pgsql`INSERT INTO creations (user_id, prompt, content, type) VALUES (${userId}, 'Remove image from background', ${secure_url}, 'image')`


        return res.status(200).json({ success: true, content: secure_url })



    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, message: error.message })
    }
}
export const RemoveImageObject = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { object } = req.body
        const image = req.file
        const plan = req.plan
        console.log(object)

        if (!image || !object) {
            return res.status(400).json({ success: false, message: "Please upload 1 image and specify the object" })
        }


        const { public_id } = await cloudinary.uploader.upload(image.path)

        const image_url = cloudinary.url(public_id, {
            transformation: [
                { effect: `gen_remove:${object}` }
            ],
            resource_type: "image"
        })

        const insert = `Remove ${object} from image`
        console.log(typeof insert)

        const query = await pgsql`INSERT INTO creations (user_id, prompt, content, type) VALUES (${userId}, ${insert}, ${image_url}, 'image')`


        return res.status(200).json({ success: true, content: image_url })

    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, message: error.message })
    }
}
export const ResumeReview = async (req, res) => {
    try {
        const { userId } = req.auth()
        const resume = req.file
        const plan = req.plan


        if (!resume) {
            return res.status(400).json({ success: false, message: "Please upload resume to review" })
        }

        if (resume.size > 5 * 1024 * 1024) {
            return res.json({ success: false, message: "Resume pdf should not be greater than 5mb" })
        }

        const dataBuffer = fs.readFileSync(resume.path)
        const pdfData = await new PDFParse(dataBuffer)

        const prompt = `Review the following resume and provide constructive feedback on its strengths, weaknesses, and areas for improvement. Resume Content:\n\n${pdfData.text}`

        const response = await openai.chat.completions.create({
            model: "gemini-3-flash-preview",
            messages: [{
                role: "user", content: prompt,
            }
            ],
            temperature: 0.7,
            max_tokens: 1000
        })

        const content = response.choices[0].message.content

        const query = await pgsql`INSERT INTO creations (user_id, prompt, content, type) VALUES (${userId}, 'Review the uploaded resume', ${content}, 'resume-review')`

        return res.status(200).json({ success: true, content })



    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, message: error.message })
    }
}