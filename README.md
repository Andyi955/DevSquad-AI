# 🤖 Multi-Agent Code Assistant

A fun, interactive web application where AI agents (DeepSeek & Gemini) collaborate as a development team to review, improve, and test your code!

### 📸 Screenshots

<div align="center">
  <img src="docs/images/dashboard1.png" alt="Main Interface" width="800">
  <br><i>Main chat interface with real-time streaming and neon theme</i>
  <br><br>
  <img src="docs/images/dashboard_demo.gif" alt="Dashboard Demo" width="800">
  <br><i>Live Multi-Agent Collaboration Dashboard</i>
  <br><br>
  <img src="docs/images/research_demo.gif" alt="Deep Research Demo" width="800">
  <br><i>Tandem agents performing parallel search and synthesis</i>
</div>

## ✨ Features

- **🧙 Senior Dev** (Gemini) - Architecture, planning, Mission Checklist management
- **🐣 Junior Dev** (Gemini) - Implementation, code writing, bug fixes
- **🧪 Unit Tester** (Gemini) - Test creation (Pytest/Unittest), quality assurance
- **🔍 Researcher** (Gemini) - Targeted web searches, documentation lookups
- **🏗️ Research Lead** (Gemini) - Deep research orchestration, report synthesis

#### 🔬 Dedicated Deep Research
The Research framework uses a **Tandem Architecture** for maximum depth and speed:
1.  **Lead Architect (Gemini 3 Flash)**: Orchestrates the mission, performs high-speed web searches, and scrapes multiple sources in parallel.
2.  **Synthesis Engine (DeepSeek V3)**: Analyzes the gathered raw data and synthesizes it into a high-impact Executive Report.

### 🧠 Hybrid "Thinking" Process
We utilize a combination of **Gemini 3 Flash** for development speed and **DeepSeek-V3** (via `deepseek-chat`) for the final research synthesis and complex reasoning.
- Agents explicitly show their internal monologue using `<think>` tags.
- This "Show Your Work" approach allows you to see *how* the agent arrived at a solution before it writes any code.
- The **Junior Dev** and **Senior Dev** use it to plan architectural and implementation steps.
- The **Researcher** uses it to formulate search strategies and cross-reference sources.
- The **Summarizer** uses it to analyze multi-source data for the final report.

### Highlights
- 🎬 **Real-time streaming** - Watch agents think and respond live
- 📝 **Mission Checklists** - Agents create and track multi-step plans automatically
- 💻 **Terminal Integration** - Embedded PowerShell terminal with automated task execution
- 🧪 **Smart Test Runner** - Agents can write AND run tests (`pytest`, `unittest`) autonomously
- ⚡ **Optimistic UI** - Instant feedback for stop actions and state changes
- 📎 **File Context** - Intelligent file reading (only reads what is needed)
- 🔒 **Safe Switch Management** - Dynamically switch between project folders without data loss
- 🌈 **Color-coded Diffs** - Visual representation of code additions and removals
- 📊 **Usage tracking** - Monitor API usage and costs

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- API Keys for [Gemini](https://aistudio.google.com/), [DeepSeek](https://platform.deepseek.com/), and [Serper](https://serper.dev/) (for web research)

### 1. Clone & Setup

```bash
cd DevSquad-AI

# Copy environment file and add your API keys
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY, DEEPSEEK_API_KEY, and SERPER_API_KEY
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\activate

# Activate (Mac/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers (for web research)
playwright install chromium

# Start the server (Hypercorn recommended for Windows/Playwright stability)
hypercorn main:app --bind 0.0.0.0:8000 --reload
```

---


### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

### 4. Open the App

Visit **http://localhost:5173** 🎉

---

## 📁 Project Structure

```
DevSquad-AI/
├── backend/
│   ├── main.py              # FastAPI server
│   ├── agents/              # AI agent personas
│   │   ├── orchestrator.py  # Manages conversations
│   │   ├── senior_dev.py    # Gemini senior dev
│   │   ├── junior_dev.py    # DeepSeek junior dev
│   │   ├── unit_tester.py   # Gemini tester
│   │   ├── researcher.py    # DeepSeek researcher
│   │   └── research_lead.py # Deep research coordinator
│   ├── prompts/             # Fine-tuned system prompts
│   ├── services/            # File manager, browser, etc.
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main layout
│   │   ├── components/      # React components
│   │   └── index.css        # Neon theme
│   └── package.json
├── projects/                # Your dynamically managed project folders
├── .env                     # Your API keys
└── README.md
```

---

## 🎮 How It Works

### 🧠 System Logic
The application is designed around a **State Machine pattern** where each AI agent acts as a specialized node in a collaborative workflow. 

- **Mission Checklists**: The Senior Dev breaks down complex requests into a step-by-step `[MISSION_CHECKLIST]`. Agents execute one step at a time and mark it complete.
- **Autonomous Delegation**: Agents decide who is best suited for the next step (e.g., Senior Dev hands off implementation to Junior Dev, who hands off to Unit Tester).
- **The Orchestrator**: The central `orchestrator.py` manages the "handoff" logic, parsing `[→AGENT]` cues and ensuring strict sequential execution.
- **Terminal & Task Safety**: On Windows, PowerShell is the forced default to ensure terminal stability. The system uses log debouncing and fuzzy echo filtering to prevent terminal "noise" from cluttering the agent's context memory.
- **Priority Review**: Agents cannot execute code until the user has approved the file changes. The orchestrator now pauses all follow-up tasks (like `RUN_TESTS`) specifically until the "Save" is confirmed.

### Agent Cue System
Agents communicate via special cues in their responses:

| Cue | Action |
|-----|--------|
| `[→SENIOR]` | Pass conversation to Senior Dev |
| `[→JUNIOR]` | Pass to Junior Dev |
| `[→TESTER]` | Pass to Unit Tester |
| `[→RESEARCH]` | Request web research |
| `[MISSION_CHECKLIST]` | Create a new task plan |
| `[CHECKLIST_UPDATE]` | Mark a task step as complete |
| `[PROJECT_COMPLETE]` | Mark the entire mission as finished |
| `[EDIT_FILE:path]` | Propose file edit (requires approval) |
| `[CREATE_FILE:path]` | Create a new file (requires approval) |
| `[READ_FILE:path]` | Read file content in background |
| `[RUN_TESTS:cmd]` | Automate test execution (e.g., `pytest`) |
| `[RUN_COMMAND:cmd]` | Run general shell commands for verification |
| `[DONE]` | End current turn |

### File Safety
- ✅ Create new files
- ✅ Edit existing files
- ✅ Delete files (requires explicit approval)
- 🔒 All changes require user approval
- 📁 **Dynamic Sandboxing** - Prevents access outside the active project folder
- 🧹 **Intelligent Scrubbing** - Raw technical tags and oversized code blocks are moved to the Review Panel for readability

---

## ⚙️ Configuration

Edit `.env` to customize:

```env
# Required
GEMINI_API_KEY=your_key
DEEPSEEK_API_KEY=your_key

# Optional
MAX_FILE_SIZE_MB=10          # Max upload size
ENABLE_BROWSER_AGENT=true    # Enable web browsing
USAGE_LIMIT_PER_DAY=1000     # API call limit
```

---

## 🛠️ API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/upload` | POST | Upload files/folders to project |
| `/chat` | POST | Send message to agents |
| `/ws/agents` | WebSocket | Real-time agent stream |
| `/files` | GET | List active project files |
| `/create-folder`| POST | Create a new directory |
| `/move` | POST | Move files/folders (Drag & Drop) |
| `/rename` | POST | Rename files/folders inline |
| `/select-folder`| GET | Open native folder picker |
| `/set-workspace`| POST | Switch active project |
| `/approve` | POST | Approve/Reject file changes |
| `/research` | POST | Web research query |
| `/usage` | GET | API usage stats |

---

## 🔮 Roadmap

### Phase 2: AWS Deployment
- [ ] S3 for file storage
- [ ] Lambda for agent execution
- [ ] DynamoDB for session history
- [ ] CloudFront CDN

### Future Ideas
- [ ] More agent personas (DevOps, Security, etc.)
- [ ] Git integration
- [ ] Voice chat with agents
- [ ] VS Code extension

---

## 📝 License

MIT License - feel free to use and modify!

---

## 🙏 Acknowledgments

- [Google Gemini](https://deepmind.google/technologies/gemini/) - AI backbone (flash-preview-series)
- [Playwright](https://playwright.dev/) - Browser automation
- [FastAPI](https://fastapi.tiangolo.com/) - Backend framework
- [React](https://react.dev/) - Frontend framework

---

## 📞 Contact

[Andrew Ivory](https://www.linkedin.com/in/andrewivory1)


---
