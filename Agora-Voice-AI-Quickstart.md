# Build Voice AI Agents in Minutes — A Hackathon Starter Guide

Whether you're joining the Agora hackathon or just exploring conversational AI for the first time, this guide gets you from zero to a working AI agent you can talk to. The entire setup takes one prompt to an AI coding assistant.

> **Note:** This guide focuses on Agora Conversational AI — the most popular path for this hackathon. However, the hackathon accepts **any Agora product** (RTC, RTM, App Builder, Cloud Recording). 

# Quick Links

| Resource                                   | Official Link                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **Agora Console**                          | <https://console.agora.io/>                                                                                   |
| **Agora Agent Studio**                     | <https://console.agora.io/studio/>                                                                            |
| **Studio Doucmentation**                   | <https://docs.agora.io/en/conversational-ai/studio/overview>                                                  |
| **Conversational AI Engine Documentation** | [https://docs.agora.io/en/conversational-ai/](https://docs.agora.io/en/conversational-ai/models/tts/overview) |
| **Conversational AI Engine RESTful API**   | <https://docs.agora.io/en/conversational-ai/rest-api/agent/join>                                              |
| **Conversationa AI Engine Telephony API**  | <https://docs.agora.io/en/conversational-ai/rest-api/telephony/start>                                         |
| **RESTful API Keys**                       | <https://console.agora.io/restful-api>                                                                        |
| **Project Starter Kit**                    | <https://github.com/AgoraIO-Conversational-AI/agent-samples>                                                  |
| **Agora Skillls For Vibe Coding**          | <https://github.com/agoraio/skills>                                                                           |

## What You'll Build (with this guide)

A real-time voice AI agent running in your browser. You speak, the agent listens, thinks, and talks back — with sub-second latency, interruption handling, and live transcription. Building with a different Agora product? You'll still need [Agora Credentials](#agora-credentials-always-required) — then head to the [Agora Docs](https://docs.agora.io/) for your product. If you're using Coding Agent, the [Agora Skill](#install-the-agora-skill) covers all Agora products, not just ConvoAI.

Try it now at **[convoai-demo.agora.io](https://convoai-demo.agora.io/)** — no setup required.

Everything runs on [Agora's Conversational AI Platform](https://docs.agora.io/en/conversational-ai/overview/product-overview). The open-source [agent-samples](https://github.com/AgoraIO-Conversational-AI/agent-samples) repo gives you a Python backend and React frontends that work out of the box.

## Ways to Build

You don't need to write code. Pick the approach you're comfortable with:

### Coding Agent

Coding agent can read the instructions, install dependencies, set up environment variables, and run the servers from a single prompt. The repo also includes an AGENT.md file designed for AI coding assistants, so it can follow the workflow directly.

We recommend using coding agents, it works well for navigating the full project structure and handling larger codebases with agent-assisted development.

**Example prompt** (works with any of the above):

```
Clone https://github.com/AgoraIO-Conversational-AI/agent-samples
and then I want to run the React Voice AI Agent here on my laptop.
Be sure to read the AGENT.md before you begin building.
```

For video with avatar:

```
Clone https://github.com/AgoraIO-Conversational-AI/agent-samples
and then I want to run the Video AI Agent with Avatar Sample here
on my laptop. Be sure to read the AGENT.md before you begin building.
```

The agent reads `AGENT.md`, installs dependencies, asks for your API keys, configures `.env`, and starts both servers. Within minutes you have a working agent in your browser.

#### Install the Agora Skill

Optional — gives Coding Agent built-in knowledge of all Agora products (RTC, RTM, ConvoAI, Cloud Recording), token generation, and more:

```bash
npx skills add github:agoraio/skills
```

## What You'll Need

### Agora Credentials (Always Required)

Every path starts with an Agora App ID and App Certificate:

1. Sign up at the [Agora Console](https://console.agora.io)
2. Create a project under [Project Management](https://console.agora.io/project-management)
3. Enable the **App Certificate** in your project's Security settings

```bash
APP_ID=your_agora_app_id
APP_CERTIFICATE=your_agora_app_certificate
```

The App Certificate enables token-based authentication. The backend generates secure tokens automatically — no separate REST API key needed.

## How It Works

Four components, two Local and two Cloud:

```
Your Browser (React client)
    ↕ audio/video via Agora SD-RTN
AI Agent Instance (Cloud, managed by Agora)
    ↕ STT → LLM → TTS pipeline
Your Backend (Python, Local)
    → calls Agora REST API to start/stop agents
```

**Your Backend** (Local) — A Python server that generates Agora tokens and calls the REST API to spin up agents with your LLM/TTS configuration.

**The Client** (Local) — A React app that captures your mic audio and plays back the agent's voice. The repo includes a polished voice client, a video avatar client, and simpler HTML versions.

**Agora SD-RTN** (Cloud) — Agora's global real-time network. Routes audio bidirectionally between you and the agent. No WebRTC complexity to manage.

**The AI Agent** (Cloud) — A managed agent that joins the channel as a participant. Your speech is transcribed (STT), sent to your LLM, and the response is synthesized (TTS) and streamed back. It handles interruptions — start talking and the agent stops to listen.

## Hackathon Ideas

With Agora as your foundation, here are starting points:

- **AI Campus Assistant** — Real-time AI agent for student support.
- **Disaster Response Communication Hub** — AI-powered voice routing and translation.
- **Remote Skills Coaching Platform** — Interactive coaching with live feedback.
- **Smart Community Helpdesk** — Virtual helpdesk using conversational AI.
- **Mental Wellness Companion** — Privacy-first AI companion for guided conversations.

That's it. Once your coding agent is running, you communicate in plain English.

## Conversation AI Modules&#x20;

| Resource              | Link                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **ASR Providers**     | <https://docs.agora.io/en/conversational-ai/models/asr/overview>                                                         |
| **LLM Providers**     | <https://docs.agora.io/en/conversational-ai/models/llm/overview>                                                         |
| **Custom LLM Server** | [github.com/AgoraIO-Conversational-AI/server-custom-llm](https://github.com/AgoraIO-Conversational-AI/server-custom-llm) |
| **TTS Providers**     | <https://docs.agora.io/en/conversational-ai/models/tts/overview>                                                         |

