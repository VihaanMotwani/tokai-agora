"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import {
  Mic,
  MicOff,
  Settings,
  PhoneOff,
  SendHorizontal,
  HelpCircle,
  PenTool,
  Move,
  Shapes,
  ZoomIn,
  Video,
  VideoOff,
  Sparkles,
} from "lucide-react"
import { useAgoraVoiceClient } from "@/hooks/useAgoraVoiceClient"
import { useWhiteboard, type ViewMode } from "@/hooks/useWhiteboard"
import { useDiagramGenerator } from "@/hooks/useDiagramGenerator"
import dynamic from "next/dynamic"
import { IconButton } from "@agora/agent-ui-kit"
import { SettingsDialog, SessionPanel } from "@agora/agent-ui-kit"
import { cn } from "@/lib/utils"
import { MobileTabs } from "@agora/agent-ui-kit"
import { ThymiaPanel, useThymia } from "@agora/agent-ui-kit/thymia"
import type { RTMEventSource } from "@agora/agent-ui-kit/thymia"
import type { Editor } from "tldraw"

// Dynamic import for tldraw (client-side only)
const Whiteboard = dynamic(() => import("./Whiteboard"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-surface-container-lowest">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-primary-container border-t-transparent rounded-full animate-spin" />
        <span className="text-on-surface-variant text-sm font-body">Loading whiteboard...</span>
      </div>
    </div>
  ),
})

const DEFAULT_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8082"
const DEFAULT_PROFILE = process.env.NEXT_PUBLIC_DEFAULT_PROFILE || "VOICE"
const THYMIA_ENABLED = process.env.NEXT_PUBLIC_ENABLE_THYMIA === "true"

const SENSITIVE_KEYS = [
  "api_key",
  "key",
  "token",
  "adc_credentials_string",
  "subscriber_token",
  "rtm_token",
  "ticket",
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function redactSensitiveFields(obj: any): any {
  if (typeof obj !== "object" || obj === null) return obj
  if (Array.isArray(obj)) return obj.map(redactSensitiveFields)
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.includes(k) && typeof v === "string" && v.length > 6) {
      out[k] = v.slice(0, 6) + "***"
    } else {
      out[k] = redactSensitiveFields(v)
    }
  }
  return out
}

export function VoiceClient() {
  // Connection state
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL)
  const [agentId, setAgentId] = useState<string | undefined>(undefined)
  const [channelName, setChannelName] = useState<string | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [chatMessage, setChatMessage] = useState("")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [enableAivad, setEnableAivad] = useState(true)
  const [language, setLanguage] = useState("en-US")
  const [profile, setProfile] = useState("")
  const [prompt, setPrompt] = useState("")
  const [greeting, setGreeting] = useState("")
  const [sessionAgentId, setSessionAgentId] = useState<string | null>(null)
  const [sessionPayload, setSessionPayload] = useState<object | null>(null)
  const [autoConnect, setAutoConnect] = useState(false)
  const [returnUrl, setReturnUrl] = useState<string | null>(null)
  const [selectedMic, setSelectedMic] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("selectedMicId") || "" : ""
  )
  const [sessionTitle, setSessionTitle] = useState("Learning Session")
  const [isCameraOn, setIsCameraOn] = useState(false)

  const conversationRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)

  // Whiteboard state
  const whiteboard = useWhiteboard()

  // Read URL parameters on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const urlProfile = params.get("profile")
      if (urlProfile) {
        setProfile(urlProfile)
      }
      if (params.get("autoconnect") === "true") {
        setAutoConnect(true)
      }
      const ru = params.get("returnurl")
      if (ru) {
        setReturnUrl(ru)
      }
    }
  }, [])

  const {
    isConnected,
    isMuted,
    messageList,
    currentInProgressMessage,
    isAgentSpeaking,
    localAudioTrack,
    joinChannel,
    leaveChannel,
    toggleMute,
    sendMessage,
    agentUid,
    rtmClientRef,
  } = useAgoraVoiceClient()

  // Diagram generator
  const diagramGenerator = useDiagramGenerator({
    onDiagramGenerated: (shapeIds) => {
      console.log("Diagram generated with shapes:", shapeIds)
    },
    onError: (error) => {
      console.error("Diagram generation error:", error)
    },
  })

  // Track processed message IDs to avoid duplicate diagram generation
  const processedMessageIds = useRef<Set<string>>(new Set())

  // Process messages for diagram generation
  useEffect(() => {
    if (messageList.length > 0) {
      const lastMessage = messageList[messageList.length - 1]
      const messageId = `${lastMessage.turn_id}-${lastMessage.uid}`

      // Skip if already processed
      if (processedMessageIds.current.has(messageId)) {
        return
      }
      processedMessageIds.current.add(messageId)

      const isAgent = agentUid ? lastMessage.uid === agentUid : false
      diagramGenerator.addToHistory(lastMessage.text, isAgent ? "agent" : "user")

      // Auto-generate diagram on user messages with trigger words
      if (!isAgent && diagramGenerator.shouldGenerateDiagram(lastMessage.text)) {
        diagramGenerator.generate(lastMessage.text)
      }
    }
  }, [messageList, agentUid, diagramGenerator])

  // RTM event source adapter for Thymia hooks
  const rtmSource = useMemo<RTMEventSource | null>(() => {
    const rtm = rtmClientRef.current
    if (!rtm) return null
    return {
      on: (event: string, handler: (evt: { message: string | Uint8Array }) => void) => {
        if (event === "message") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(rtm as any).addEventListener("message", handler)
        }
      },
      off: (event: string, handler: (evt: { message: string | Uint8Array }) => void) => {
        if (event === "message") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(rtm as any).removeEventListener("message", handler)
        }
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rtmClientRef.current])

  // Thymia voice biomarker data
  const {
    biomarkers,
    wellness,
    clinical,
    progress: thymiaProgress,
    safety: thymiaSafety,
  } = useThymia(rtmSource, THYMIA_ENABLED && isConnected)

  // Handle mic selection change
  const handleMicChange = async (deviceId: string) => {
    setSelectedMic(deviceId)
    if (deviceId) {
      localStorage.setItem("selectedMicId", deviceId)
    } else {
      localStorage.removeItem("selectedMicId")
    }
    if (isConnected && localAudioTrack && deviceId) {
      try {
        await localAudioTrack.setDevice(deviceId)
      } catch (err) {
        console.error("Failed to switch microphone:", err)
      }
    }
  }

  const handleStart = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        enable_aivad: enableAivad.toString(),
        asr_language: language,
      })

      if (profile.trim()) {
        params.append("profile", profile.trim())
      } else {
        params.append("profile", DEFAULT_PROFILE)
      }

      if (prompt.trim()) {
        params.append("prompt", prompt.trim())
      }
      if (greeting.trim()) {
        params.append("greeting", greeting.trim())
      }

      // Phase 1: Get tokens only
      params.append("connect", "false")
      const tokenUrl = `${backendUrl}/start-agent?${params.toString()}`
      const tokenResponse = await fetch(tokenUrl)

      if (!tokenResponse.ok) {
        throw new Error(`Backend error: ${tokenResponse.statusText}`)
      }

      const data = await tokenResponse.json()
      setChannelName(data.channel)

      // Phase 2: Join channel first
      await joinChannel({
        appId: data.appid,
        channel: data.channel,
        token: data.token || null,
        uid: parseInt(data.uid),
        rtmUid: data.user_rtm_uid,
        agentUid: data.agent?.uid ? String(data.agent.uid) : undefined,
        agentRtmUid: data.agent_rtm_uid,
        ...(selectedMic ? { microphoneId: selectedMic } : {}),
      })

      // Phase 3: Start the agent
      params.delete("connect")
      params.append("channel", data.channel)
      params.append("debug", "true")
      const agentUrl = `${backendUrl}/start-agent?${params.toString()}`
      const agentResponse = await fetch(agentUrl)

      if (!agentResponse.ok) {
        throw new Error(`Agent start error: ${agentResponse.statusText}`)
      }

      const agentData = await agentResponse.json()

      if (agentData.agent_response?.response) {
        try {
          const resp =
            typeof agentData.agent_response.response === "string"
              ? JSON.parse(agentData.agent_response.response)
              : agentData.agent_response.response
          if (resp.agent_id) {
            setAgentId(resp.agent_id)
            setSessionAgentId(resp.agent_id)
          }
        } catch {
          // ignore parse errors
        }
      }

      if (agentData.debug?.agent_payload) {
        setSessionPayload(redactSensitiveFields(agentData.debug.agent_payload))
      }
    } catch (error) {
      console.error("Failed to start:", error)
      alert(`Failed to start: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-connect
  useEffect(() => {
    if (autoConnect) {
      setAutoConnect(false)
      handleStart()
    }
  }, [autoConnect])

  const handleStop = async () => {
    if (agentId) {
      try {
        const params = new URLSearchParams({ agent_id: agentId })
        if (channelName) params.append("channel", channelName)
        if (profile.trim()) params.append("profile", profile.trim())
        await fetch(`${backendUrl}/hangup-agent?${params}`)
      } catch (e) {
        console.error("Hangup failed:", e)
      }
    }
    setAgentId(undefined)
    setChannelName(undefined)
    setSessionAgentId(null)
    setSessionPayload(null)
    await leaveChannel()
    if (returnUrl) {
      window.location.href = returnUrl
      return
    }
  }

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !isConnected) return

    const success = await sendMessage(chatMessage)
    if (success) {
      setChatMessage("")
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const isAgentMessage = (uid: string) => {
    return agentUid ? uid === agentUid : false
  }

  const formatTime = (ts?: number) => {
    if (!ts) return ""
    const d = new Date(ts)
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
  }

  const handleEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor
    whiteboard.setEditor(editor)
    diagramGenerator.setEditor(editor)
  }, [whiteboard, diagramGenerator])

  // View mode labels
  const viewModeLabels: Record<ViewMode, string> = {
    whiteboard: "Whiteboard",
    mindmap: "Mind Map",
    "3d": "3D View",
  }

  if (!isConnected) {
    // Pre-connection: Tokai-styled connection form
    return (
      <div className="flex h-screen flex-col bg-surface overflow-hidden">
        {/* Header */}
        <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-primary-container text-on-primary">
          <div className="flex items-center gap-8">
            <span className="text-2xl font-black text-white font-headline tracking-tight">Tokai</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 hover:bg-white/10 transition-colors rounded-full"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button className="p-2 hover:bg-white/10 transition-colors rounded-full">
              <HelpCircle className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-grow flex items-center justify-center pt-16">
          {(autoConnect || isLoading) ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-3 border-primary-container border-t-transparent rounded-full animate-spin" />
              <p className="text-lg text-on-surface-variant font-headline">Connecting to your tutor...</p>
            </div>
          ) : (
            <div className="w-full max-w-md learning-sheet p-10 mx-4">
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-16 h-16 bg-secondary-container/30 rounded-full flex items-center justify-center mb-6">
                  <Sparkles className="w-8 h-8 text-secondary" />
                </div>
                <h1 className="font-headline font-extrabold text-2xl text-on-surface mb-3 tracking-tight">
                  Start Learning Session
                </h1>
                <p className="text-on-surface-variant">
                  Connect with your AI tutor and start exploring
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label htmlFor="backend" className="mb-2 block text-sm font-medium text-on-surface-variant">
                    Backend URL
                  </label>
                  <input
                    id="backend"
                    type="text"
                    value={backendUrl}
                    onChange={(e) => setBackendUrl(e.target.value)}
                    placeholder={DEFAULT_BACKEND_URL}
                    className="w-full rounded-lg bg-surface-container-high px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary border-none"
                  />
                </div>

                <div>
                  <label htmlFor="profile" className="mb-2 block text-sm font-medium text-on-surface-variant">
                    Server Profile
                  </label>
                  <input
                    id="profile"
                    type="text"
                    value={profile}
                    onChange={(e) => setProfile(e.target.value)}
                    placeholder={DEFAULT_PROFILE}
                    className="w-full rounded-lg bg-surface-container-high px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary border-none"
                  />
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Leave empty for default &ldquo;{DEFAULT_PROFILE}&rdquo; profile
                  </p>
                </div>

                <button
                  onClick={handleStart}
                  disabled={isLoading}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <span>Start Session</span>
                  <span className="text-lg">→</span>
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Settings Dialog */}
        <SettingsDialog
          open={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          enableAivad={enableAivad}
          onEnableAivadChange={setEnableAivad}
          language={language}
          onLanguageChange={setLanguage}
          prompt={prompt}
          onPromptChange={setPrompt}
          greeting={greeting}
          onGreetingChange={setGreeting}
          disabled={isConnected}
          selectedMicId={selectedMic}
          onMicChange={handleMicChange}
        >
          <SessionPanel agentId={sessionAgentId} payload={sessionPayload} />
        </SettingsDialog>
      </div>
    )
  }

  // Connected: Tokai learning workspace
  return (
    <div className="flex h-screen flex-col bg-surface overflow-hidden">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-primary-container text-on-primary">
        <div className="flex items-center gap-8">
          <span className="text-2xl font-black text-white font-headline tracking-tight">Tokai</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 hover:bg-white/10 transition-colors rounded-full"
          >
            <Settings className="h-5 w-5" />
          </button>
          <button className="p-2 hover:bg-white/10 transition-colors rounded-full">
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow flex pt-16 pb-20 overflow-hidden relative">
        {/* Left: Whiteboard Area (70%) */}
        <section className="w-[70%] h-full bg-surface-container-lowest dot-grid relative overflow-hidden flex flex-col">
          {/* Canvas Overlay UI */}
          <div className="absolute top-6 left-6 flex flex-col gap-2 z-10">
            <h1 className="text-2xl font-black font-headline text-primary tracking-tight">{sessionTitle}</h1>
            <p className="text-on-surface-variant text-sm font-medium">
              {isAgentSpeaking ? "Tutor speaking..." : "Listening..."}
            </p>
          </div>

          {/* Generating indicator */}
          {diagramGenerator.isGenerating && (
            <div className="absolute top-6 right-6 z-10 flex items-center gap-2 bg-secondary/10 text-secondary px-4 py-2 rounded-full">
              <div className="w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">Generating diagram...</span>
            </div>
          )}

          {/* Excalidraw Whiteboard */}
          <div className="flex-1 relative">
            <Whiteboard
              className="w-full h-full"
              onEditorReady={handleEditorReady}
              viewMode={whiteboard.viewMode}
            />
          </div>

          {/* Whiteboard Controls (Bottom Left) */}
          <div className="absolute bottom-6 left-6 flex gap-2 glass p-2 rounded-full shadow-sm z-10">
            <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors text-primary">
              <Move className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors text-primary">
              <PenTool className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors text-primary">
              <Shapes className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-outline-variant/30 my-auto mx-1" />
            <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors text-primary">
              <ZoomIn className="w-5 h-5" />
            </button>
          </div>
        </section>

        {/* Right: Study Tools Sidebar (30%) */}
        <aside className="fixed right-0 top-16 bottom-20 w-[30%] bg-surface-container-low flex flex-col p-6 rounded-l-xl shadow-[-20px_0_40px_rgba(28,75,66,0.06)] z-40 transition-all duration-300 ease-in-out">
          <div className="mb-6">
            <h2 className="text-primary font-headline text-2xl font-black tracking-tight">Study Tools</h2>
            <p className="text-on-surface-variant/60 text-sm font-medium">Active Session Analysis</p>
          </div>

          {/* View Mode Toggle */}
          <div className="bg-surface-container-high p-1.5 rounded-full flex items-center mb-6">
            {(["whiteboard", "mindmap", "3d"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => whiteboard.setViewMode(mode)}
                className={cn(
                  "flex-1 py-2.5 px-3 rounded-full text-xs font-bold font-headline transition-all",
                  whiteboard.viewMode === mode
                    ? "bg-surface-container-lowest text-secondary shadow-sm"
                    : "text-on-surface-variant/50 hover:bg-white/30"
                )}
              >
                {viewModeLabels[mode]}
              </button>
            ))}
          </div>

          {/* Transcript Section */}
          <MobileTabs
            tabs={[
              {
                id: "transcript",
                label: "Transcript",
                content: (
                  <div className="flex flex-col h-full">
                    <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-4">
                      {messageList.map((msg, idx) => {
                        const isAgent = isAgentMessage(msg.uid)
                        const time = formatTime(msg.timestamp)
                        return (
                          <div
                            key={`${msg.turn_id}-${msg.uid}-${idx}`}
                            className="bg-white/60 p-4 rounded-2xl"
                          >
                            <p className="text-xs font-bold text-secondary mb-1">
                              {time && `${time} — `}
                              {isAgent ? "Tutor" : "You"}
                            </p>
                            <p className="text-sm text-on-surface">{msg.text}</p>
                          </div>
                        )
                      })}

                      {/* In-progress message */}
                      {currentInProgressMessage && (
                        <div className="bg-white/60 p-4 rounded-2xl animate-pulse">
                          <p className="text-xs font-bold text-secondary mb-1">
                            {formatTime(currentInProgressMessage.timestamp) &&
                              `${formatTime(currentInProgressMessage.timestamp)} — `}
                            {isAgentMessage(currentInProgressMessage.uid) ? "Tutor" : "You"}
                          </p>
                          <p className="text-sm text-on-surface">{currentInProgressMessage.text}</p>
                        </div>
                      )}

                      {messageList.length === 0 && !currentInProgressMessage && (
                        <div className="text-center py-8 text-on-surface-variant/50">
                          <p className="text-sm">Conversation will appear here...</p>
                        </div>
                      )}
                    </div>

                    {/* Chat Input */}
                    <div className="mt-4 pt-4 border-t border-outline-variant/20">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          onKeyPress={handleKeyPress}
                          placeholder="Type a message..."
                          className="flex-1 rounded-full bg-surface-container-high px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary border-none"
                        />
                        <button
                          onClick={handleSendMessage}
                          disabled={!chatMessage.trim()}
                          className="h-10 w-10 flex items-center justify-center rounded-full bg-primary-container text-on-primary hover:bg-primary transition-colors disabled:opacity-50"
                        >
                          <SendHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ),
              },
              ...(THYMIA_ENABLED
                ? [
                    {
                      id: "thymia",
                      label: "Wellness",
                      content: (
                        <ThymiaPanel
                          biomarkers={biomarkers}
                          wellness={wellness}
                          clinical={clinical}
                          progress={thymiaProgress}
                          safety={thymiaSafety}
                          isConnected={isConnected}
                        />
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </aside>
      </main>

      {/* Bottom Navigation Bar */}
      <footer className="fixed bottom-0 left-0 w-full z-50 flex justify-center items-center gap-8 px-10 pb-4 glass h-20 rounded-t-xl shadow-[0_-10px_30px_rgba(28,75,66,0.04)]">
        <div className="flex items-center gap-12">
          {/* Mic Toggle */}
          <button
            onClick={toggleMute}
            className="flex flex-col items-center gap-1 group"
          >
            <div
              className={cn(
                "p-3 rounded-full transition-all group-hover:scale-110",
                isMuted
                  ? "bg-error/10 text-error"
                  : "text-primary"
              )}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">
              {isMuted ? "Muted" : "Mic"}
            </span>
          </button>

          {/* Camera Toggle (placeholder) */}
          <button
            onClick={() => setIsCameraOn(!isCameraOn)}
            className="flex flex-col items-center gap-1 group"
          >
            <div
              className={cn(
                "p-3 rounded-full transition-all group-hover:scale-110",
                !isCameraOn
                  ? "text-on-surface-variant/50"
                  : "text-primary"
              )}
            >
              {isCameraOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Camera</span>
          </button>

          {/* End Session */}
          <button
            onClick={handleStop}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="p-3 bg-error/10 text-error rounded-full group-hover:scale-110 transition-transform px-6 flex items-center gap-2">
              <PhoneOff className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">End Session</span>
            </div>
          </button>
        </div>
      </footer>

      {/* Settings Dialog */}
      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        enableAivad={enableAivad}
        onEnableAivadChange={setEnableAivad}
        language={language}
        onLanguageChange={setLanguage}
        prompt={prompt}
        onPromptChange={setPrompt}
        greeting={greeting}
        onGreetingChange={setGreeting}
        disabled={isConnected}
        selectedMicId={selectedMic}
        onMicChange={handleMicChange}
      >
        <SessionPanel agentId={sessionAgentId} payload={sessionPayload} />
      </SettingsDialog>
    </div>
  )
}
