"use client"

import { useCallback, useRef, useState } from "react"
import { generateDiagramImage, isGeminiConfigured, type GeneratedImage } from "@/lib/gemini"
import type { Editor, TLShapeId, TLAssetId } from "tldraw"
import { AssetRecordType, createShapeId } from "tldraw"

interface UseDiagramGeneratorOptions {
  onDiagramGenerated?: (shapeId: TLShapeId) => void
  onError?: (error: string) => void
}

// Keywords that trigger diagram generation
const DIAGRAM_TRIGGERS = [
  "draw",
  "diagram",
  "visualize",
  "mind map",
  "mindmap",
  "flowchart",
  "chart",
  "illustrate",
  "sketch",
  "show me",
  "picture",
  "visual",
  "map out",
  "outline",
  "image",
]

export function useDiagramGenerator(options: UseDiagramGeneratorOptions = {}) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [lastImage, setLastImage] = useState<GeneratedImage | null>(null)
  const conversationHistoryRef = useRef<string[]>([])
  const editorRef = useRef<Editor | null>(null)

  const setEditor = useCallback((editor: Editor) => {
    editorRef.current = editor
  }, [])

  // Add a message to conversation history for context
  const addToHistory = useCallback((message: string, speaker: "user" | "agent") => {
    const entry = `${speaker === "user" ? "Student" : "Teacher"}: ${message}`
    conversationHistoryRef.current.push(entry)
    // Keep last 10 messages for context
    if (conversationHistoryRef.current.length > 10) {
      conversationHistoryRef.current.shift()
    }
  }, [])

  // Check if text contains diagram trigger words
  const shouldGenerateDiagram = useCallback((text: string): boolean => {
    const lowerText = text.toLowerCase()
    return DIAGRAM_TRIGGERS.some((trigger) => lowerText.includes(trigger))
  }, [])

  // Extract topic from text
  const extractTopic = useCallback((text: string): string => {
    let topic = text.toLowerCase()
    DIAGRAM_TRIGGERS.forEach((trigger) => {
      topic = topic.replace(new RegExp(trigger, "gi"), "")
    })
    topic = topic
      .replace(/can you/gi, "")
      .replace(/please/gi, "")
      .replace(/about/gi, "")
      .replace(/of/gi, "")
      .replace(/a /gi, " ")
      .replace(/the /gi, " ")
      .replace(/for me/gi, "")
      .trim()

    return topic || "the current topic"
  }, [])

  // Add generated image to the canvas
  const addImageToCanvas = useCallback((image: GeneratedImage): TLShapeId | null => {
    const editor = editorRef.current
    if (!editor) {
      console.error("Editor not available")
      return null
    }

    try {
      // Create asset ID
      const assetId = AssetRecordType.createId() as TLAssetId

      // Default image dimensions (will be updated when image loads)
      const imageWidth = 600
      const imageHeight = 400

      // Create the asset with base64 data
      editor.createAssets([
        {
          id: assetId,
          type: "image",
          typeName: "asset",
          props: {
            name: "diagram.png",
            src: `data:${image.mimeType};base64,${image.base64}`,
            w: imageWidth,
            h: imageHeight,
            mimeType: image.mimeType,
            isAnimated: false,
          },
          meta: {},
        },
      ])

      // Create the image shape
      const shapeId = createShapeId()

      // Get viewport center
      const viewportBounds = editor.getViewportPageBounds()
      const centerX = viewportBounds.x + viewportBounds.w / 2 - imageWidth / 2
      const centerY = viewportBounds.y + viewportBounds.h / 2 - imageHeight / 2

      editor.createShape({
        id: shapeId,
        type: "image",
        x: centerX,
        y: centerY,
        props: {
          assetId,
          w: imageWidth,
          h: imageHeight,
        },
      })

      // Zoom to fit
      setTimeout(() => {
        editor.zoomToFit({ padding: 50 })
      }, 100)

      return shapeId
    } catch (error) {
      console.error("Error adding image to canvas:", error)
      return null
    }
  }, [])

  // Generate diagram from text
  const generate = useCallback(
    async (text: string): Promise<TLShapeId | null> => {
      if (!isGeminiConfigured()) {
        options.onError?.("Gemini API not configured")
        return null
      }

      if (!editorRef.current) {
        options.onError?.("Editor not ready")
        return null
      }

      setIsGenerating(true)
      try {
        const topic = extractTopic(text)
        const context = conversationHistoryRef.current.slice(-5).join("\n") // Last 5 messages

        console.log("Generating diagram for topic:", topic)
        const image = await generateDiagramImage(topic, context)

        if (!image) {
          options.onError?.("Failed to generate diagram image")
          return null
        }

        setLastImage(image)
        const shapeId = addImageToCanvas(image)

        if (shapeId) {
          options.onDiagramGenerated?.(shapeId)
        }

        return shapeId
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        options.onError?.(message)
        return null
      } finally {
        setIsGenerating(false)
      }
    },
    [extractTopic, addImageToCanvas, options]
  )

  // Process a message and generate diagram if triggered
  const processMessage = useCallback(
    async (
      message: string,
      speaker: "user" | "agent"
    ): Promise<TLShapeId | null> => {
      addToHistory(message, speaker)

      // Only trigger on user messages that contain trigger words
      if (speaker === "user" && shouldGenerateDiagram(message)) {
        return generate(message)
      }

      return null
    },
    [addToHistory, shouldGenerateDiagram, generate]
  )

  return {
    isGenerating,
    lastImage,
    generate,
    processMessage,
    addToHistory,
    shouldGenerateDiagram,
    setEditor,
    isConfigured: isGeminiConfigured(),
  }
}
