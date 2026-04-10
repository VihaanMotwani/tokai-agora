"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { FilesetResolver, GestureRecognizer, GestureRecognizerResult } from "@mediapipe/tasks-vision"
import type { Editor } from "tldraw"

export type GestureType =
  | "None"
  | "Closed_Fist"      // Pan mode
  | "Open_Palm"        // Stop/reset
  | "Pointing_Up"      // Select tool
  | "Thumb_Up"         // Confirm/OK
  | "Victory"          // Two fingers - zoom
  | "ILoveYou"         // Three fingers

export type GestureMode = "idle" | "draw" | "pan" | "select"

interface UseHandGesturesOptions {
  onGestureChange?: (gesture: GestureType, mode: GestureMode) => void
  onDraw?: (x: number, y: number, isDrawing: boolean) => void
  onPan?: (deltaX: number, deltaY: number) => void
}

export function useHandGestures(options: UseHandGesturesOptions = {}) {
  const [isEnabled, setIsEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [currentGesture, setCurrentGesture] = useState<GestureType>("None")
  const [gestureMode, setGestureMode] = useState<GestureMode>("idle")
  const [error, setError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const gestureRecognizerRef = useRef<GestureRecognizer | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null)
  const isDrawingRef = useRef(false)

  const setEditor = useCallback((editor: Editor) => {
    editorRef.current = editor
  }, [])

  const setVideoElement = useCallback((video: HTMLVideoElement | null) => {
    videoRef.current = video
  }, [])

  const setCanvasElement = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas
  }, [])

  // Initialize MediaPipe Gesture Recognizer
  const initializeGestureRecognizer = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      )

      const recognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })

      gestureRecognizerRef.current = recognizer
      setIsLoading(false)
      return true
    } catch (err) {
      console.error("Failed to initialize gesture recognizer:", err)
      setError("Failed to initialize hand tracking")
      setIsLoading(false)
      return false
    }
  }, [])

  // Start webcam
  const startCamera = useCallback(async () => {
    if (!videoRef.current) return false

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: "user"
        }
      })

      videoRef.current.srcObject = stream
      await videoRef.current.play()
      return true
    } catch (err) {
      console.error("Failed to start camera:", err)
      setError("Failed to access camera")
      return false
    }
  }, [])

  // Stop webcam
  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
  }, [])

  // Convert hand landmark to canvas coordinates
  const landmarkToCanvasCoords = useCallback((landmark: { x: number; y: number; z: number }) => {
    const editor = editorRef.current
    if (!editor) return null

    const video = videoRef.current
    if (!video) return null

    // Mirror the x coordinate (webcam is mirrored)
    const mirroredX = 1 - landmark.x

    // Get viewport bounds
    const viewportBounds = editor.getViewportPageBounds()

    // Map normalized coordinates to canvas space
    const canvasX = viewportBounds.x + mirroredX * viewportBounds.w
    const canvasY = viewportBounds.y + landmark.y * viewportBounds.h

    return { x: canvasX, y: canvasY }
  }, [])

  // Check if pinching (thumb tip close to index tip)
  const isPinching = useCallback((landmarks: Array<{ x: number; y: number; z: number }>) => {
    if (landmarks.length < 9) return false

    const thumbTip = landmarks[4]  // Thumb tip
    const indexTip = landmarks[8]  // Index finger tip

    const distance = Math.sqrt(
      Math.pow(thumbTip.x - indexTip.x, 2) +
      Math.pow(thumbTip.y - indexTip.y, 2)
    )

    return distance < 0.05 // Threshold for pinch detection
  }, [])

  // Process gesture results
  const processGestures = useCallback((results: GestureRecognizerResult) => {
    if (!results.landmarks || results.landmarks.length === 0) {
      setCurrentGesture("None")
      if (isDrawingRef.current) {
        isDrawingRef.current = false
        options.onDraw?.(0, 0, false)
      }
      return
    }

    const landmarks = results.landmarks[0]
    const gestures = results.gestures?.[0]

    // Get gesture name
    let gestureName: GestureType = "None"
    if (gestures && gestures.length > 0) {
      gestureName = gestures[0].categoryName as GestureType
    }

    // Check for pinch gesture (for drawing)
    const pinching = isPinching(landmarks)

    // Get index finger position
    const indexTip = landmarks[8]
    const coords = landmarkToCanvasCoords(indexTip)

    // Determine mode based on gesture
    let newMode: GestureMode = gestureMode

    if (pinching || gestureName === "Pointing_Up") {
      newMode = "draw"
    } else if (gestureName === "Closed_Fist") {
      newMode = "pan"
    } else if (gestureName === "Open_Palm") {
      newMode = "select"
    } else {
      newMode = "idle"
    }

    // Update state
    if (gestureName !== currentGesture) {
      setCurrentGesture(gestureName)
      options.onGestureChange?.(gestureName, newMode)
    }

    if (newMode !== gestureMode) {
      setGestureMode(newMode)

      // Stop drawing if mode changed
      if (gestureMode === "draw" && newMode !== "draw") {
        isDrawingRef.current = false
        options.onDraw?.(0, 0, false)
      }
    }

    // Handle drawing
    if (coords && newMode === "draw") {
      if (!isDrawingRef.current) {
        isDrawingRef.current = true
      }
      options.onDraw?.(coords.x, coords.y, true)
    }

    // Handle panning
    if (coords && newMode === "pan" && lastPositionRef.current) {
      const deltaX = coords.x - lastPositionRef.current.x
      const deltaY = coords.y - lastPositionRef.current.y
      options.onPan?.(deltaX, deltaY)
    }

    // Update last position
    if (coords) {
      lastPositionRef.current = coords
    }
  }, [currentGesture, gestureMode, isPinching, landmarkToCanvasCoords, options])

  // Detection loop
  const detectGestures = useCallback(() => {
    const recognizer = gestureRecognizerRef.current
    const video = videoRef.current

    if (!recognizer || !video || video.readyState !== 4) {
      animationFrameRef.current = requestAnimationFrame(detectGestures)
      return
    }

    const startTime = performance.now()
    const results = recognizer.recognizeForVideo(video, startTime)

    processGestures(results)

    animationFrameRef.current = requestAnimationFrame(detectGestures)
  }, [processGestures])

  // Enable hand gestures
  const enable = useCallback(async () => {
    if (isEnabled) return

    const initialized = await initializeGestureRecognizer()
    if (!initialized) return

    const cameraStarted = await startCamera()
    if (!cameraStarted) return

    setIsEnabled(true)
    animationFrameRef.current = requestAnimationFrame(detectGestures)
  }, [isEnabled, initializeGestureRecognizer, startCamera, detectGestures])

  // Disable hand gestures
  const disable = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    stopCamera()
    setIsEnabled(false)
    setCurrentGesture("None")
    setGestureMode("idle")
    isDrawingRef.current = false
    lastPositionRef.current = null
  }, [stopCamera])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disable()
      gestureRecognizerRef.current?.close()
    }
  }, [disable])

  return {
    isEnabled,
    isLoading,
    currentGesture,
    gestureMode,
    error,
    enable,
    disable,
    setEditor,
    setVideoElement,
    setCanvasElement,
  }
}
