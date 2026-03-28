import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

export const model = new ChatOpenAI({
  modelName: "gpt-40",
  temperature: 0.7,
  maxTokens: 1000,
});

export const embeddings = new OpenAIEmbeddings();
