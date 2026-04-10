"use client"

import { useRef, useEffect } from "react"
import { Hand, Video, VideoOff, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useHandGestures, type GestureMode, type GestureType } from "@/hooks/useHandGestures"
import type { Editor } from "tldraw"
import { createShapeId } from "tldraw"
import { b64Vecs } from "@tldraw/editor"

interface GestureCameraProps {
  editor: Editor | null
  className?: string
}

const GESTURE_LABELS: Record<GestureType, string> = {
  None: "No hand detected",
  Closed_Fist: "✊ Pan mode",
  Open_Palm: "✋ Select mode",
  Pointing_Up: "☝️ Draw mode",
  Thumb_Up: "👍 OK",
  Victory: "✌️ Zoom",
  ILoveYou: "🤟 Special",
}

const MODE_COLORS: Record<GestureMode, string> = {
  idle: "bg-surface-container-high",
  draw: "bg-secondary",
  pan: "bg-primary-container",
  select: "bg-tertiary-accent",
}

export function GestureCamera({ editor, className }: GestureCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const drawingPathRef = useRef<{ x: number; y: number }[]>([])
  const currentShapeIdRef = useRef<string | null>(null)

  const {
    isEnabled,
    isLoading,
    currentGesture,
    gestureMode,
    error,
    enable,
    disable,
    setEditor,
    setVideoElement,
  } = useHandGestures({
    onGestureChange: (gesture, mode) => {
      console.log("Gesture changed:", gesture, "Mode:", mode)
    },
    onDraw: (x, y, isDrawing) => {
      if (!editor) return

      if (isDrawing) {
        // Add point to current path
        drawingPathRef.current.push({ x, y, z: 0.5 })

        // Create or update freehand shape
        if (drawingPathRef.current.length >= 2) {
          // Convert to relative points from first point
          const firstPoint = drawingPathRef.current[0]
          const relativePoints = drawingPathRef.current.map((p) => ({
            x: p.x - firstPoint.x,
            y: p.y - firstPoint.y,
            z: 0.5,
          }))

          // Encode points to base64 format
          const encodedPath = b64Vecs.encodePoints(relativePoints)

          if (!currentShapeIdRef.current) {
            // Create new draw shape
            const id = createShapeId()
            currentShapeIdRef.current = id
            editor.createShape({
              id,
              type: "draw",
              x: firstPoint.x,
              y: firstPoint.y,
              props: {
                color: "black",
                fill: "none",
                dash: "draw",
                size: "m",
                segments: [
                  {
                    type: "free",
                    path: encodedPath,
                  },
                ],
                isComplete: false,
                isClosed: false,
                isPen: false,
                scale: 1,
              },
            })
          } else {
            // Update existing shape
            editor.updateShape({
              id: currentShapeIdRef.current as any,
              type: "draw",
              props: {
                segments: [
                  {
                    type: "free",
                    path: encodedPath,
                  },
                ],
              },
            })
          }
        }
      } else {
        // Drawing stopped - finalize shape
        if (currentShapeIdRef.current) {
          editor.updateShape({
            id: currentShapeIdRef.current as any,
            type: "draw",
            props: {
              isComplete: true,
            },
          })
        }
        drawingPathRef.current = []
        currentShapeIdRef.current = null
      }
    },
    onPan: (deltaX, deltaY) => {
      if (!editor) return
      // Pan the viewport
      const camera = editor.getCamera()
      editor.setCamera({
        x: camera.x - deltaX * 0.5,
        y: camera.y - deltaY * 0.5,
        z: camera.z,
      })
    },
  })

  // Set editor reference
  useEffect(() => {
    if (editor) {
      setEditor(editor)
    }
  }, [editor, setEditor])

  // Set video element reference
  useEffect(() => {
    if (videoRef.current) {
      setVideoElement(videoRef.current)
    }
  }, [setVideoElement])

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Camera Preview */}
      <div className="relative rounded-xl overflow-hidden bg-surface-container-highest aspect-video">
        <video
          ref={videoRef}
          className={cn(
            "w-full h-full object-cover transform scale-x-[-1]",
            !isEnabled && "hidden"
          )}
          playsInline
          muted
        />

        {!isEnabled && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Hand className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-2" />
              <p className="text-sm text-on-surface-variant/50">
                Camera off
              </p>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/80">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}

        {/* Gesture indicator overlay */}
        {isEnabled && (
          <div className="absolute bottom-2 left-2 right-2">
            <div
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium text-center transition-colors",
                MODE_COLORS[gestureMode],
                gestureMode === "draw" && "text-on-secondary",
                gestureMode === "pan" && "text-on-primary",
                gestureMode !== "draw" && gestureMode !== "pan" && "text-on-surface"
              )}
            >
              {GESTURE_LABELS[currentGesture]}
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-error/10">
            <p className="text-sm text-error px-4 text-center">{error}</p>
          </div>
        )}
      </div>

      {/* Toggle Button */}
      <button
        onClick={isEnabled ? disable : enable}
        disabled={isLoading}
        className={cn(
          "flex items-center justify-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-all",
          isEnabled
            ? "bg-error/10 text-error hover:bg-error/20"
            : "bg-secondary text-on-secondary hover:bg-secondary/90",
          isLoading && "opacity-50 cursor-not-allowed"
        )}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isEnabled ? (
          <VideoOff className="w-4 h-4" />
        ) : (
          <Video className="w-4 h-4" />
        )}
        <span>{isEnabled ? "Stop Gestures" : "Start Gestures"}</span>
      </button>

      {/* Instructions */}
      {isEnabled && (
        <div className="text-xs text-on-surface-variant/60 space-y-1 px-2">
          <p>☝️ <strong>Point</strong> or pinch to draw</p>
          <p>✊ <strong>Fist</strong> to pan</p>
          <p>✋ <strong>Palm</strong> to select</p>
        </div>
      )}
    </div>
  )
}
