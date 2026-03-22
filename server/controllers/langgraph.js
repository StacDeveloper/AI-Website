import { StringOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { END, StateGraph } from "@langchain/langgraph";
import { configDotenv } from "dotenv";
import pgsql from "../configs/db";
configDotenv()

const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-flash-preview",
    temperature: 0.7,
    apiKey: process.env.GEMINI_API_KEY
})

const embedding = new GoogleGenerativeAIEmbeddings({
    model: "gemini-embedding-001",
    temperature: 0.7,
    apiKey: process.env.GEMINI_API_KEY
})

const parser = new StringOutputParser()


const classifyQuestion = async (state) => {
    try {
        const chain = PromptTemplate.fromTemplate(`
             Classify this question into ONE of these categories:
                    - skill_check     (asking about skills or technologies)
                    - job_fit         (asking if suitable for a role)
                    - improvement     (asking what to improve or is missing)
                    - salary          (asking about salary or market value)
                    - general         (anything else)
                    Reply with ONLY the category word, nothing else.
                    Question: {question}
            `).pipe(model).pipe(parser)
        const answer = await chain.invoke({ question: state.question })
        return { ...state, answer }

    } catch (error) {
        console.log(error)
    }
}

const fetchContext = async (state) => {
    try {
        let searchQuery
        switch (state.questionType) {
            case "skill_check":
                searchQuery = state.question
                break;
            case "job_fit":
                searchQuery = `experience skills ${state.question}`
                break;
            case "improvement":
                searchQuery = `skills experience projects ${state.question}`
                break;
            case "salary":
                searchQuery = `experience years skills ${state.question}`
                break;
            case "general":
                searchQuery = state.question
                break;
            default:
                searchQuery = "general"
                break
        }

        let questionVector = await embedding.embedQuery(searchQuery)
        if (questionVector) {
            questionVector = questionVector.slice(0, 768)
        }

        const getChunks = ["job_fit", "improvement"]


        const chunkLimit = getChunks.includes(state.questionType) ? 8 : 4
        const chunks = await pgsql`SELECT content FROM resume_chunks WHERE user_id = ${state.userId} ORDER BY <=> ${JSON.stringify(questionVector)}::vector LIMIT ${chunkLimit}`

        const context = chunks.map(c => c.content).join('\n\n') || "No Resume Found"

        return { ...state, context }

    } catch (error) {
        console.log(error)
    }
}

const answerSkillCheck = async (state,res) => {
    try {
        const chain = PromptTemplate.fromTemplate(`
             Based on this resume content, answer the skill question clearly. List specific technologies and rate proficiency if possible. Resume: {context} Question: {question}
            `).pipe(model).pipe(parser)

        const answer = await chain.stream(state)
        for await (const chunk of answer) {
            res.write(chunk)
        }
        res.end()
    } catch (error) {
        console.log(error)
    }
}
const answerJobFit = async (state) => {
    try {
        const chain = PromptTemplate.fromTemplate(`
             Based on this resume, assess the candidate's fit for the role. Give a fit score out of 10. List matching skills. List missing skills. Give a clear recommendation.Resume: {context} Question: {question}
            `).pipe(model).pipe(parser)

        const answer = await chain.invoke(state)
        return { ...state, answer }
    } catch (error) {
        console.log(error)
    }
}

const answerImprovement = async (state) => {
    try {
        const chain = PromptTemplate.fromTemplate(`Based on this resume, identify specific gaps and improvements. Be direct and actionable. Prioritize the most impactful improvements first. Resume: {context} Question: {question}
    `).pipe(model).pipe(parser)

        const answer = await chain.invoke(state)
        return { ...state, answer }
    } catch (error) {
        console.log(error)
    }
}

const answerSalary = async (state) => {
    try {
        const chain = PromptTemplate.fromTemplate(`
                Based on this resume, estimate the market salary range.
                Consider: years of experience, skills, and tech stack.
                Give a realistic range and explain why.
                
                Resume: {context}
                Question: {question}
            `).pipe(model).pipe(parser)

        const answer = await chain.invoke(state)
        return { ...state, answer }
    } catch (error) {
        console.log(error)
    }
}

const answerGeneral = async (state) => {
    const chain = PromptTemplate.fromTemplate(`
        Answer this question using only the resume context provided.
        
        Resume: {context}
        Question: {question}
    `).pipe(model).pipe(parser)

    const answer = await chain.invoke(state)
    return { ...state, answer }
}

const workFlow = new StateGraph({
    channels: {
        userId: { values: (x, y) => y ?? x },
        question: { values: (x, y) => y ?? x },
        questionType: { values: (x, y) => y ?? x },
        context: { values: (x, y) => y ?? x },
        answer: { values: (x, y) => y ?? x },
    }
})

workFlow.addNode("classify", classifyQuestion)
workFlow.addNode("fetchContext", fetchContext)
workFlow.addNode("skillCheck", answerSkillCheck)
workFlow.addNode("jobFit", answerJobFit)
workFlow.addNode("improvemnt", answerImprovement)
workFlow.addNode("salary", answerSalary)
workFlow.addNode("general", answerGeneral)

workFlow.setEntryPoint("classify")
workFlow.addEdge("classify", "fetchContext")

workFlow.addConditionalEdges("fetchContext", (state) => {
    const routes = {
        skill_check: "skillCheck",
        jobfit: "jobFit",
        improvement: "improvement",
        salary: "salary",
        general: "general",
    }
    return routes[state.questionType] || "general"
})

workFlow.addEdge("skillCheck", END)
workFlow.addEdge("jobFit", END)
workFlow.addEdge("improvement", END)
workFlow.addEdge("salary", END)
workFlow.addEdge("general", END)

const resumeGraph = workFlow.compile()


