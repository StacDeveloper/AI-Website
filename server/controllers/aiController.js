import { clerkClient } from "@clerk/express"
import pgsql from "../configs/db.js"
import openai from "../configs/gemini.js"
import axios from "axios"
import { v2 as cloudinary } from "cloudinary"
import { configDotenv } from "dotenv"
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
            max_tokens: 100
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
            const { response } = await axios.post('https://clipdrop-api.co/text-to-image/v1', formData, {
                headers: {
                    'x-api-key': apiKey,
                },
                responseType: "arraybuffer"
            })
            const base64image = `data:image/png;base64,${Buffer.from(response, "binary").toString("base64")}`

            const { secure_url } = await cloudinary.uploader.upload(base64image)



            const query = await pgsql`INSERT INTO creations (user_id, prompt, content, type, publish) VALUES (${userId}, ${prompt}, ${secure_url}, 'image', ${publish ?? false})`

            if (plan !== "premium") {
                await clerkClient.users.updateUserMetadata(userId, {
                    privateMetadata: {
                        free_usage: free_usage + 1
                    }
                })
            }

            return res.status(200).json({ success: true, content: secure_url })
        } else {
            return res.json({ sucess: false, message: "Api key not provided" })
        }






    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, message: error.message })
    }
}