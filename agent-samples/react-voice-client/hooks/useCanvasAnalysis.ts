"use client"

import { useCallback, useRef } from "react"
import type { Editor } from "tldraw"
import { GoogleGenerativeAI } from "@google/generative-ai"

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null

const CANVAS_ANALYSIS_PROMPT = `You are analyzing a whiteboard/canvas from an educational tutoring session.

Describe what you see concisely in 1-2 sentences, focusing on:
1. Any diagrams, mind maps, or educational content
2. Any user annotations like circles, arrows, or highlights that indicate areas of interest
3. Any handwritten notes or markings

If you see circles, arrows pointing to something, or underlines, mention what the user seems to be highlighting or asking about.

Keep your description brief and factual. Start with "The canvas shows..." or "I can see..."`

export function useCanvasAnalysis() {
  const editorRef = useRef<Editor | null>(null)

  const setEditor = useCallback((editor: Editor) => {
    editorRef.current = editor
  }, [])

  // Capture canvas as base64 image
  const captureCanvas = useCallback(async (): Promise<string | null> => {
    const editor = editorRef.current
    if (!editor) {
      console.error("Editor not available")
      return null
    }

    try {
      const shapeIds = editor.getCurrentPageShapeIds()
      if (shapeIds.size === 0) {
        return null // Empty canvas
      }

      const result = await editor.toImage([...shapeIds], {
        format: "png",
        background: true,
        scale: 0.5, // Lower resolution for faster upload
      })

      if (!result?.blob) {
        return null
      }

      // Convert blob to base64
      const buffer = await result.blob.arrayBuffer()
      const base64 = Buffer.from(buffer).toString("base64")
      return base64
    } catch (error) {
      console.error("Error capturing canvas:", error)
      return null
    }
  }, [])

  // Analyze canvas with Gemini Vision
  const analyzeCanvas = useCallback(async (): Promise<string | null> => {
    if (!genAI) {
      console.error("Gemini not configured")
      return null
    }

    const base64Image = await captureCanvas()
    if (!base64Image) {
      return null
    }

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" })

      const result = await model.generateContent([
        { text: CANVAS_ANALYSIS_PROMPT },
        {
          inlineData: {
            mimeType: "image/png",
            data: base64Image,
          },
        },
      ])

      const response = result.response.text()
      return response.trim()
    } catch (error) {
      console.error("Error analyzing canvas:", error)
      return null
    }
  }, [captureCanvas])

  // Check if canvas has content worth analyzing
  const hasContent = useCallback((): boolean => {
    const editor = editorRef.current
    if (!editor) return false
    return editor.getCurrentPageShapeIds().size > 0
  }, [])

  return {
    setEditor,
    captureCanvas,
    analyzeCanvas,
    hasContent,
  }
}
