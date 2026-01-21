# Changelog

All notable changes to the DevSquad AI project.

## [2026-01-21]

### ⚡ Performance & Stability
- **Deep Research Architecture**: Switched "Research Lead" to Gemini 2.0 Flash for superior orchestration and "Collaborator" to DeepSeek V3 for high-speed synthesis.
- **Optimized Gemini Streaming**: Removed verbose debug logging and error noise from Gemini streaming response handler.
- **Stop Button Latency**: Implemented optimistic UI updates for the "Stop" button. It now reacts instantly by resetting the UI state while the backend terminates the process in the background.

### 🤖 Agent System Improvements
- **Mission Checklists**: 
    - Implemented a structured `[MISSION_CHECKLIST]` system managed by the Senior Dev.
    - Agents now rigorously track progress item-by-item (`[x]`) before marking a project complete.
    - Prevents premature "Mission Accomplished" states.
- **Hybrid "DeepThink"**:
    - Enabled DeepSeek's chain-of-thought (`<think>`) reasoning for Junior Dev and Researcher agents.
    - This allows for "System 2" thinking (planning before coding) while maintaining fast chat responses.
- **Strict Handoff Logic**:
    - Enforced a `Senior -> Junior (Implement) -> Senior (Review) -> Tester (Verify)` workflow.
    - Prevented Junior Dev from attempting testing; removed "Tester" capabilities from Junior's prompt.
    - Prevented Tester from attempting implementation; enforced "Fail Fast" handoffs to Junior if files are missing.

### 💅 UI/UX Enhancements
- **Clean Output Formatting**:
    - **No Sticky Words**: Fixed a Junior Dev formatting bug where backticks merged with words (e.g., `thefile.py`).
    - **Header Protection**: Added logic to protect "## Headers" and "### Subheaders" from being garbled during stream cleanup.
    - **Ghost Punctuation**: Fixed issues where removing technical tags left behind floating commas and periods.
- **Review Panel Fullscreen**:
    - Auto-closes full-screen diff view upon approval/rejection for smoother workflow.

### 🐛 Bug Fixes
- **Orchestrator Loop**: Fixed a potential infinite loop where the Unit Tester would continuously try to read a non-existent file. It now hands off to Junior Dev immediately.
- **Playwright Errors**: Fixed `NotImplementedError` on Windows by switching the ASGI server to Hypercorn.
- **File Uploads**: Added logic to detach the previous workspace before uploading a new one to prevent nested project folders.
