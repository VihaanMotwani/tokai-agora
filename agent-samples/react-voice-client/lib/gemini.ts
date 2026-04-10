import { GoogleGenerativeAI } from "@google/generative-ai"

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY

if (!GEMINI_API_KEY) {
  console.warn("NEXT_PUBLIC_GEMINI_API_KEY not set - diagram generation will be disabled")
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null

export interface GeneratedImage {
  base64: string
  mimeType: string
}

const IMAGE_GENERATION_PROMPT = `Create a clean, educational diagram or mind map illustration.

Style requirements:
- Clean white or light background
- Simple, clear shapes and lines
- Professional educational style like a textbook diagram
- Use colors strategically: green for main concepts, blue/yellow/orange for subtopics
- Include clear labels with readable text
- Hierarchical layout with main topic prominent
- Connected with neat arrows or lines
- Minimal clutter, maximum clarity

DO NOT include any explanatory text outside the diagram itself.
Generate ONLY the diagram image.`

export async function generateDiagramImage(
  topic: string,
  conversationContext?: string
): Promise<GeneratedImage | null> {
  if (!genAI) {
    console.error("Gemini API not configured")
    return null
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-image-preview",
      generationConfig: {
        responseModalities: ["image", "text"],
      } as any,
    })

    const prompt = conversationContext
      ? `${IMAGE_GENERATION_PROMPT}\n\nContext from conversation:\n${conversationContext}\n\nCreate a mind map or diagram about: ${topic}`
      : `${IMAGE_GENERATION_PROMPT}\n\nCreate a mind map or diagram about: ${topic}`

    const result = await model.generateContent(prompt)
    const response = result.response

    // Extract image from response
    const parts = response.candidates?.[0]?.content?.parts
    if (!parts) {
      console.error("No parts in response")
      return null
    }

    for (const part of parts) {
      if (part.inlineData) {
        return {
          base64: part.inlineData.data,
          mimeType: part.inlineData.mimeType || "image/png",
        }
      }
    }

    console.error("No image in response")
    return null
  } catch (error) {
    console.error("Error generating diagram image:", error)
    return null
  }
}

export function isGeminiConfigured(): boolean {
  return !!genAI
}
