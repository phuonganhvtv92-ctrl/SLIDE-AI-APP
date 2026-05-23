// src/geminiApi.ts
export async function callGemini(prompt: string) {
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });
  const data = await response.json();
  
  if (!data.candidates || data.candidates.length === 0) {
    throw new Error("Không nhận được phản hồi từ AI");
  }
  
  return data.candidates[0].content.parts[0].text;
}
