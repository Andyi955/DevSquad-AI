# Changelog

## [1.1.0] - 2026-01-19

### 🕵️‍♂️ Deep Research Showcase
![Deep Research Demo](./docs/images/research_demo.gif)

### 🏗️ Technical Architecture: The Agentic Pipeline
The Deep Research engine operates as a tri-agent collaborative system:
1. **The Architect (Research Lead)**: Powered by *Gemini 2.0 Flash*, it analyzes the user query and generates a multi-pronged sub-research plan.
2. **The Ground Crew (Researcher)**: Powered by *Gemini 1.5 Flash*, it executes the plan by searching the live web and scraping full-page content using Playwright.
3. **The Expert Writer (Summarizer)**: Powered by *DeepSeek V3/R1*, it synthesizes the mass of collected raw data into a structured Executive Report, ensuring technical accuracy and readability.

### Added
- **Deep Research Engine**: New dedicated tab for exhaustive web research via multiple search passes.
- **Downloadable Reports**: Users can now export the final Executive Report as a `.md` file.
- **Hoverable Source Map**: A floating research tray at the bottom of reports that reveals sources on hover.
- **Date/Time Context**: Injected environmental time into all agent prompts for better historical/current awareness.

### Changed
- **Gemini SDK Migration**: Upgraded backend from legacy `google-generativeai` to the modern `google-genai` SDK for improved stability and performance.
- **UI Refresh**: Completely redesigned main navigation tabs with neon purple/cyan active states.
- **Layout Overhaul**: Migrated from CSS Grid to a responsive Flexbox architecture.
- **Responsive Modes**: Added breakpoints for medium (1100px) and compact (800px) resolutions.
- **Optimized Synthesis**: DeepSeek V3 now handles report generation with strict Markdown header protection.

### Fixed
- **Test Integrity**: Fully restored the backend test suite (`pytest`), resolving 12+ regressions related to async handling and missing routes.
- **Hypercorn Stability**: Resolved `WinError 10038` and `LifespanFailure` crashes on Windows during server reloads.
- **White Background Glitch**: Implemented global CSS resets to prevent default browser button styles from appearing.
- **Playwright Fallback**: Added a circuit-breaker to disable Playwright if system drivers are missing, preventing crash loops.
- **Display Cleaning**: Improved regex-based text cleaning to prevent section headers from merging into paragraphs.
- **Route Restoration**: Re-implemented missing workspace and file operation endpoints in `main.py`.
