"use client"

import { useCallback, useEffect, useState } from "react"
import { Tldraw, Editor, TLShapeId, createShapeId } from "tldraw"
import "tldraw/tldraw.css"

// Tokai color palette
const TOKAI_COLORS = {
  primary: "#1c4b42",
  secondary: "#006c53",
  accent: "#f7a900",
  surface: "#f6fbf5",
  onSurface: "#171d1a",
  outline: "#707976",
  error: "#ba1a1a",
}

interface WhiteboardProps {
  className?: string
  onEditorReady?: (editor: Editor) => void
  viewMode?: "whiteboard" | "mindmap" | "3d"
}

export default function Whiteboard({
  className = "",
  onEditorReady,
  viewMode = "whiteboard",
}: WhiteboardProps) {
  const [editor, setEditor] = useState<Editor | null>(null)

  const handleMount = useCallback((editor: Editor) => {
    setEditor(editor)
    if (onEditorReady) {
      onEditorReady(editor)
    }
  }, [onEditorReady])

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ height: "100%", width: "100%" }}
    >
      <Tldraw
        onMount={handleMount}
        hideUi={false}
        inferDarkMode={false}
      />
    </div>
  )
}

// Export for external use
export { TOKAI_COLORS }
export type { WhiteboardProps }
