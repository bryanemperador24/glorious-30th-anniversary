import Groq from "groq-sdk";

const groq = new Groq(); // reads GROQ_API_KEY from env

const res = await groq.chat.completions.create({
  model: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
  messages: [{ role: "user", content: "Reply with exactly: Groq is connected." }],
});
console.log(res.choices[0].message.content);
