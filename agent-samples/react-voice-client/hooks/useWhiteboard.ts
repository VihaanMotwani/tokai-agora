"use client"

import { useCallback, useRef, useState } from "react"
import type { Editor, TLShapeId } from "tldraw"
import { createShapeId } from "tldraw"

export type ViewMode = "whiteboard" | "mindmap" | "3d"

interface UseWhiteboardOptions {
  onShapesChange?: () => void
}

export function useWhiteboard(options: UseWhiteboardOptions = {}) {
  const editorRef = useRef<Editor | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("whiteboard")
  const [isGenerating, setIsGenerating] = useState(false)

  const setEditor = useCallback((editor: Editor) => {
    editorRef.current = editor
  }, [])

  const getEditor = useCallback((): Editor | null => {
    return editorRef.current
  }, [])

  const clearCanvas = useCallback(() => {
    const editor = editorRef.current
    if (editor) {
      editor.selectAll()
      editor.deleteShapes(editor.getSelectedShapeIds())
    }
  }, [])

  // Create a text shape
  const createText = useCallback((
    text: string,
    x: number,
    y: number,
    options: { color?: string; size?: "s" | "m" | "l" | "xl" } = {}
  ): TLShapeId => {
    const editor = editorRef.current
    if (!editor) throw new Error("Editor not initialized")

    const id = createShapeId()
    editor.createShape({
      id,
      type: "text",
      x,
      y,
      props: {
        text,
        size: options.size ?? "m",
        color: "black",
      },
    })
    return id
  }, [])

  // Create a rectangle/box shape
  const createBox = useCallback((
    x: number,
    y: number,
    width: number,
    height: number,
    options: { color?: string; label?: string } = {}
  ): TLShapeId => {
    const editor = editorRef.current
    if (!editor) throw new Error("Editor not initialized")

    const id = createShapeId()
    editor.createShape({
      id,
      type: "geo",
      x,
      y,
      props: {
        w: width,
        h: height,
        geo: "rectangle",
        color: "green",
        fill: "solid",
        text: options.label ?? "",
      },
    })
    return id
  }, [])

  // Create an ellipse shape
  const createEllipse = useCallback((
    x: number,
    y: number,
    width: number,
    height: number,
    options: { color?: string; label?: string } = {}
  ): TLShapeId => {
    const editor = editorRef.current
    if (!editor) throw new Error("Editor not initialized")

    const id = createShapeId()
    editor.createShape({
      id,
      type: "geo",
      x,
      y,
      props: {
        w: width,
        h: height,
        geo: "ellipse",
        color: "green",
        fill: "solid",
        text: options.label ?? "",
      },
    })
    return id
  }, [])

  // Create an arrow shape
  const createArrow = useCallback((
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    options: { color?: string } = {}
  ): TLShapeId => {
    const editor = editorRef.current
    if (!editor) throw new Error("Editor not initialized")

    const id = createShapeId()
    editor.createShape({
      id,
      type: "arrow",
      x: startX,
      y: startY,
      props: {
        start: { x: 0, y: 0 },
        end: { x: endX - startX, y: endY - startY },
        color: "grey",
      },
    })
    return id
  }, [])

  return {
    setEditor,
    getEditor,
    clearCanvas,
    viewMode,
    setViewMode,
    isGenerating,
    setIsGenerating,
    // Shape creators
    createText,
    createBox,
    createEllipse,
    createArrow,
  }
}
