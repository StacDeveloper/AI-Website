import { clerkClient } from '@clerk/express';
import pgsql from '../configs/db.js';
import openai from '../configs/gemini.js';
import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import { configDotenv } from 'dotenv';
import fs from 'fs';
import { PDFParse } from 'pdf-parse';
// import { PromptTemplate } from "@langchain/core/prompts";
// import { StringOutputParser } from "@langchain/core/output_parsers"
// import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai"
// import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
// import { END, StateGraph } from "@langchain/langgraph"
configDotenv();

export const GenerateArticle = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt, length } = req.body;
    const plan = req.plan;
    const free_usage = req.free_usage;

    if (!prompt || !length) {
      return res.status(400).json({
        success: false,
        message: 'Need prompt and length to generate article',
      });
    }

    if (!plan !== 'premium' && free_usage >= 10) {
      return res.json({
        success: false,
        message:
          'Your have used your credits, Please upgrade to premium plan to continue',
      });
    }

    const response = await openai.chat.completions.create({
      model: 'gemini-3-flash-preview',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: length,
    });

    const content = response.choices[0].message.content;

    const query =
      await pgsql`INSERT INTO creations (user_id, prompt, content, type) VALUES (${userId}, ${prompt}, ${content}, 'article')`;

    if (plan !== 'premium') {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: {
          free_usage: free_usage + 1,
        },
      });
    }

    return res.status(200).json({ success: true, content });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};
export const GenerateBlogTitle = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt } = req.body;
    const plan = req.plan;
    const free_usage = req.free_usage;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: 'Need prompt to generate blog-title',
      });
    }

    if (!plan !== 'premium' && free_usage >= 10) {
      return res.json({
        success: false,
        message:
          'Your have used your credits, Please upgrade to premium plan to continue',
      });
    }

    const response = await openai.chat.completions.create({
      model: 'gemini-3-flash-preview',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = response.choices[0].message.content;

    const query =
      await pgsql`INSERT INTO creations (user_id, prompt, content, type) VALUES (${userId}, ${prompt}, ${content}, 'blog-title')`;

    if (plan !== 'premium') {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: {
          free_usage: free_usage + 1,
        },
      });
    }

    return res.status(200).json({ success: true, content });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};
export const GenerateImage = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt, publish } = req.body;
    const plan = req.plan;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: 'Need prompt and publish to generate image',
      });
    }

    const formData = new FormData();
    formData.append('prompt', prompt);

    const apiKey = process.env.CLIPDROP_API_KEY;

    if (apiKey) {
      const response = await axios.post(
        'https://clipdrop-api.co/text-to-image/v1',
        formData,
        {
          headers: {
            'x-api-key': apiKey,
          },
          responseType: 'arraybuffer',
        }
      );
      const base64image = `data:image/png;base64,${Buffer.from(response.data, 'binary').toString('base64')}`;

      const { secure_url } = await cloudinary.uploader.upload(base64image);

      const query =
        await pgsql`INSERT INTO creations (user_id, prompt, content, type, publish) VALUES (${userId}, ${prompt}, ${secure_url}, 'image', ${publish ?? false})`;

      if (!query || query.length === 0) {
        return res
          .status(500)
          .json({ success: false, message: 'Failed to save creation' });
      }
      return res.status(200).json({ success: true, content: secure_url });
    }
    if (!apiKey || !query || query.length === 0) {
      return res
        .status(500)
        .json({
          success: false,
          message: 'Missing API key' || 'Failed to save creation',
        });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};
export const RemoveImageBackground = async (req, res) => {
  try {
    const { userId } = req.auth();
    const image = req.file;
    const plan = req.plan;
    console.log(image);

    if (!image) {
      return res
        .status(400)
        .json({ success: false, message: 'Need image to generate background' });
    }

    const { secure_url } = await cloudinary.uploader.upload(image.path, {
      transformation: [
        {
          effect: 'background_removal',
          background_removal: 'remove_the_background',
        },
      ],
    });

    const query =
      await pgsql`INSERT INTO creations (user_id, prompt, content, type) VALUES (${userId}, 'Remove image from background', ${secure_url}, 'image')`;

    return res.status(200).json({ success: true, content: secure_url });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};
export const RemoveImageObject = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { object } = req.body;
    const image = req.file;
    const plan = req.plan;
    console.log(object);

    if (!image || !object) {
      return res.status(400).json({
        success: false,
        message: 'Please upload 1 image and specify the object',
      });
    }

    const { public_id } = await cloudinary.uploader.upload(image.path);

    const image_url = cloudinary.url(public_id, {
      transformation: [{ effect: `gen_remove:${object}` }],
      resource_type: 'image',
    });

    const insert = `Remove ${object} from image`;

    const query =
      await pgsql`INSERT INTO creations (user_id, prompt, content, type) VALUES (${userId}, ${insert}, ${image_url}, 'image')`;

    return res.status(200).json({ success: true, content: image_url });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};
export const ResumeReview = async (req, res) => {
  try {
    const { userId } = req.auth();
    const resume = req.file;
    const plan = req.plan;

    if (!resume) {
      return res
        .status(400)
        .json({ success: false, message: 'Please upload resume to review' });
    }

    if (resume.size > 5 * 1024 * 1024) {
      return res.json({
        success: false,
        message: 'Resume pdf should not be greater than 5mb',
      });
    }

    const dataBuffer = fs.readFileSync(resume.path);
    const pdfData = await new PDFParse(dataBuffer);

    const prompt = `Review the following resume and provide constructive feedback on its strengths, weaknesses, and areas for improvement. Resume Content:\n\n${pdfData.text}`;

    const response = await openai.chat.completions.create({
      model: 'gemini-3-flash-preview',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content;

    const query =
      await pgsql`INSERT INTO creations (user_id, prompt, content, type) VALUES (${userId}, 'Review the uploaded resume', ${content}, 'resume-review')`;

    return res.status(200).json({ success: true, content });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// export const ReviewResume = async (req, res) => {
//     try {
//         const { userId } = req.auth()
//         const resume = req.file

//         if (!resume) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Please upload resume"
//             })
//         }

//         if (resume.size > 5 * 1024 * 1024) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Resume pdf should not be greater than 5mb"
//             })
//         }

//         const dataBuffer = fs.readFileSync(resume.path)

//         // convert Buffer -> Uint8Array
//         const uint8Array = new Uint8Array(dataBuffer)

//         const pdfData = await new PDFParse(uint8Array)
//         const text = await pdfData.getText().then((t) => JSON.stringify(t))

//         const model = new ChatGoogleGenerativeAI({
//             model: "gemini-3-flash-preview",
//             temperature: 0.7,
//             apiKey: process.env.GEMINI_API_KEY
//         })

//         const embedding = new GoogleGenerativeAIEmbeddings({
//             model: "gemini-embedding-001",
//             temperature: 0.7,
//             apiKey: process.env.GEMINI_API_KEY,
//         })

//         const splitter = new RecursiveCharacterTextSplitter({
//             chunkSize: 500,
//             chunkOverlap: 50
//         })
//         let vector = await embedding.embedQuery(text)

//         if (vector) {
//             vector = vector.slice(0, 768)
//         }
//         const prompt = PromptTemplate.fromTemplate(`
//             Review the following resume and provide constructive feedback
//             on its strengths, weaknesses, and areas for improvement.

//             Resume Content: {text}
//         `)
//         const reviewChain = prompt.pipe(model).pipe(new StringOutputParser())
//         const content = await reviewChain.invoke({ text })
//         const chunks = await splitter.createDocuments([text])

//         await Promise.all(chunks.map(async (chunk) => {
//             const chunkEmbed = await embedding.embedQuery(chunk.pageContent)
//             const embvector = chunkEmbed.slice(0, 768)
//             return pgsql`
//                 INSERT INTO resume_chunks(user_id, content, embedding)
//                 VALUES (
//                     ${userId},
//                     ${chunk.pageContent},
//                     ${JSON.stringify(embvector)}::vector
//                 )
//         `
//         }))

//         await pgsql`
//             INSERT INTO creations(user_id, prompt, content, type, embedding)
//             VALUES (
//                 ${userId},
//                 'REVIEW THE UPLOADED RESUME',
//                 ${content},
//                 'review-resume',
//                 ${JSON.stringify(vector)}::vector
//             )
//         `

//         return res.status(200).json({ success: true, content })

//     } catch (error) {
//         console.log(error)
//         return res.status(500).json({ success: false, message: error.message })
//     }
// }

// const model = new ChatGoogleGenerativeAI({
//     model: "gemini-3-flash-preview",
//     temperature: 0.7,
//     apiKey: process.env.GEMINI_API_KEY
// })

// const embedding = new GoogleGenerativeAIEmbeddings({
//     model: "gemini-embedding-001",
//     temperature: 0.7,
//     apiKey: process.env.GEMINI_API_KEY,
// })

// const parser = new StringOutputParser()

// const classifyQuestions = async (state) => {
//     try {
//         const chain = PromptTemplate.fromTemplate(`
//                     Classify this question into ONE of these categories:
//                     - skill_check     (asking about skills or technologies)
//                     - job_fit         (asking if suitable for a role)
//                     - improvement     (asking what to improve or is missing)
//                     - salary          (asking about salary or market value)
//                     - general         (anything else)
//                     Reply with ONLY the category word, nothing else.
//                     Question: {question}
//                  `).pipe(model).pipe(parser)

//         const category = await chain.invoke({ question: state.question })
//         console.log(category.trim())
//         return { ...state, questionType: category.trim() }

//     } catch (error) {
//         console.log(error)
//     }
// }
// const fetchContext = async (state) => {
//     try {
//         const searchQuery = {
//             skill_check: state.question,
//             job_fit: `experience skills ${state.question}`,
//             improvement: `skills experience projects ${state.question}`,
//             salary: `experience years skills ${state.question}`,
//             general: state.question
//         }[state.questionType] || state.question

//         let questionVector = await embedding.embedQuery(searchQuery)
//         if (questionVector) {
//             questionVector = questionVector.slice(0, 768)
//         }

//         const chunkLimit = ['job_fit', 'improvement'].includes(state.questionType) ? 8 : 4

//         const chunks = await pgsql`SELECT content FROM resume_chunks WHERE user_id = ${state.userId} ORDER BY embedding <=> ${JSON.stringify(questionVector)}::vector LIMIT ${chunkLimit}`

//         const context = chunks.map(c => c.content).join('\n\n') || "No resume context found"
//         return { ...state, context }

//     } catch (error) {
//         console.log(error)
//     }

// }
// const answerSkillCheck = async (state) => {
//     try {
//         const chain = PromptTemplate.fromTemplate(`
//             Based on this resume content, answer the skill question clearly. List specific technologies and rate proficiency if possible. Resume: {context} Question: {question}
//             `).pipe(model).pipe(parser)

//         const answer = await chain.invoke(state)
//         return { ...state, answer }

//     } catch (error) {
//         console.log(error)
//     }

// }

// const answerJobFit = async (state) => {
//     try {
//         const chain = PromptTemplate.fromTemplate(`
//         Based on this resume, assess the candidate's fit for the role. Give a fit score out of 10. List matching skills. List missing skills. Give a clear recommendation.Resume: {context} Question: {question}
//     `).pipe(model).pipe(parser)
//         const answer = await chain.invoke(state)
//         return { ...state, answer }

//     } catch (error) {
//         console.log(error)
//     }
// }

// const answerImprovement = async (state) => {
//     try {
//         const chain = PromptTemplate.fromTemplate(`Based on this resume, identify specific gaps and improvements. Be direct and actionable. Prioritize the most impactful improvements first. Resume: {context} Question: {question}
//     `).pipe(model).pipe(parser)

//         const answer = await chain.invoke(state)
//         return { ...state, answer }
//     } catch (error) {
//         console.log(error)
//     }
// }

// const answerSalary = async (state) => {
//     const chain = PromptTemplate.fromTemplate(`
//         Based on this resume, estimate the market salary range.
//         Consider: years of experience, skills, and tech stack.
//         Give a realistic range and explain why.

//         Resume: {context}
//         Question: {question}
//     `).pipe(model).pipe(parser)

//     const answer = await chain.invoke(state)
//     return { ...state, answer }
// }

// const answerGeneral = async (state) => {
//     const chain = PromptTemplate.fromTemplate(`
//         Answer this question using only the resume context provided.

//         Resume: {context}
//         Question: {question}
//     `).pipe(model).pipe(parser)

//     const answer = await chain.invoke(state)
//     return { ...state, answer }
// }

// const workFlow = new StateGraph({
//     channels: {
//         userId: { value: (x, y) => y ?? x },
//         question: { value: (x, y) => y ?? x },
//         questionType: { value: (x, y) => y ?? x },
//         context: { value: (x, y) => y ?? x },
//         answer: { value: (x, y) => y ?? x }
//     }
// })

// workFlow.addNode("classify", classifyQuestions)
// workFlow.addNode("fetchContext", fetchContext)
// workFlow.addNode("skillCheck", answerSkillCheck)
// workFlow.addNode("jobFit", answerJobFit)
// workFlow.addNode("improvement", answerImprovement)
// workFlow.addNode("salary", answerSalary)
// workFlow.addNode("general", answerGeneral)

// workFlow.setEntryPoint("classify")
// workFlow.addEdge("classify", "fetchContext")

// workFlow.addConditionalEdges("fetchContext", (state) => {
//     const routes = {
//         skill_check: "skillCheck",
//         job_fit: "jobFit",
//         improvement: "improvement",
//         salary: "salary",
//         general: "general"
//     }
//     return routes[state.questionType] || "general"
// })

// workFlow.addEdge("skillCheck", END)
// workFlow.addEdge("jobFit", END)
// workFlow.addEdge("improvement", END)
// workFlow.addEdge("salary", END)
// workFlow.addEdge("general", END)

// const resumeGraph = workFlow.compile()

// export const askaboutResume = async (req, res) => {
//     try {
//         const { userId } = req.auth()
//         const { question } = req.body

//         if (!question) {
//             return res.status(400).json({ success: false, message: "Please provide question for specific feedback" })
//         }

//         const result = await resumeGraph.invoke({
//             userId, question
//         })

//         await pgsql`INSERT INTO creations (user_id, prompt, content, type) VALUES (${userId}, ${question}, ${result.answer}, ${'result-qa-' + result.questionType})`

//         return res.status(200).json({ success: true, answer: result.answer, question: result.questionType })

//     } catch (error) {
//         console.log(error)
//         return res.status(500).json({ success: false, message: error.message })
//     }
// }
