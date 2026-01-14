# 🤖 Multi-Agent Code Assistant

A fun, interactive web application where AI agents (DeepSeek & Gemini) collaborate as a development team to review, improve, and test your code!

### 📸 Screenshots

<div align="center">
  <img src="docs/images/dashboard1.png" alt="Main Interface" width="800">
  <br><i>Main chat interface with real-time streaming and neon theme</i>
</div>

<br>

<div align="center">
  <img src="docs/images/dashboard2.png" alt="Research Panel" width="800">
  <br><i>Automated research cards and collaborative agent output</i>
</div>

## ✨ Features

- **🧙 Senior Dev** (Gemini) - Architecture, best practices, code review
- **🐣 Junior Dev** (DeepSeek) - Implementation, questions, learning  
- **🧪 Unit Tester** (Gemini) - Test coverage, edge cases, quality
- **🔍 Researcher** (DeepSeek) - Web searches, documentation, latest news

### Highlights
- 🎬 **Real-time streaming** - Watch agents think and respond live
- 💭 **Thought bubbles** - See agent reasoning (collapsible)
- ✏️ **File editing** - Agents can create/edit files with your approval
- 🌐 **Web research** - Agents browse docs, Stack Overflow, GitHub
- 🎨 **Neon dark theme** - Beautiful UI with fun animations
- 📊 **Usage tracking** - Monitor API usage and costs

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- API Keys for [Gemini](https://aistudio.google.com/) and [DeepSeek](https://platform.deepseek.com/)

### 1. Clone & Setup

```bash
cd DevSquad-AI

# Copy environment file and add your API keys
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY and DEEPSEEK_API_KEY
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

# Start the server
uvicorn main:app --reload --port 8000
```

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
│   │   └── researcher.py    # DeepSeek researcher
│   ├── prompts/             # Fine-tuned system prompts
│   ├── services/            # File manager, browser, etc.
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main layout
│   │   ├── components/      # React components
│   │   └── index.css        # Neon theme
│   └── package.json
├── workspace/               # Your uploaded files (sandboxed)
├── .env                     # Your API keys
└── README.md
```

---

## 🎮 How It Works

### Agent Cue System
Agents communicate via special cues in their responses:

| Cue | Action |
|-----|--------|
| `[→SENIOR]` | Pass conversation to Senior Dev |
| `[→JUNIOR]` | Pass to Junior Dev |
| `[→TESTER]` | Pass to Unit Tester |
| `[→RESEARCH]` | Request web research |
| `[EDIT_FILE:path]` | Propose file edit (requires approval) |
| `[DONE]` | Task complete |

### File Safety
- ✅ Create new files
- ✅ Edit existing files
- ❌ Delete files (disabled)
- 🔒 All changes require user approval
- 📁 Only operates in `/workspace` folder

---

## ⚙️ Configuration

Edit `.env` to customize:

```env
# Required
GEMINI_API_KEY=your_key
DEEPSEEK_API_KEY=your_key

# Optional
MAX_FILE_SIZE_MB=10          # Max upload size
WORKSPACE_PATH=./workspace   # File sandbox
ENABLE_BROWSER_AGENT=true    # Enable web browsing
USAGE_LIMIT_PER_DAY=1000     # API call limit
```

---

## 🛠️ API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/upload` | POST | Upload code files |
| `/chat` | POST | Send message to agents |
| `/ws/agents` | WebSocket | Real-time agent stream |
| `/files` | GET | List workspace files |
| `/files/{path}` | GET/PUT | Read/write file |
| `/approve` | POST | Approve file changes |
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

- [Google Gemini](https://deepmind.google/technologies/gemini/) - AI backbone
- [DeepSeek](https://www.deepseek.com/) - AI backbone  
- [Playwright](https://playwright.dev/) - Browser automation
- [FastAPI](https://fastapi.tiangolo.com/) - Backend framework
- [React](https://react.dev/) - Frontend framework

---
