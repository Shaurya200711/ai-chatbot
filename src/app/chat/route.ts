import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

// Initialize the Groq client with your saved API key
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: Request) {
  try {
    // 1. Read what the user typed in the frontend
    const { prompt } = await request.json();

    // 2. Ask Groq for the answer using a blazing fast Llama 3 model
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'openai/gpt-oss-120b', 
    });

    const aiResponse = chatCompletion.choices[0]?.message?.content || "No response generated.";

    // 3. Send the answer back to the frontend
    return NextResponse.json({ response: aiResponse });

  } catch (error) {
    console.error("Groq API Error:", error);
    return NextResponse.json({ error: "Failed to generate AI response" }, { status: 500 });
  }
}