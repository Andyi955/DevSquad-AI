import { useState, useEffect, useCallback, useRef } from 'react'
import './index.css'

// Components
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import AgentChat from './components/AgentChat'
import ResearchPanel from './components/ResearchPanel'
import ApprovalModal from './components/ApprovalModal'

// Hooks
import { useWebSocket } from './hooks/useWebSocket'

const API_URL = 'http://localhost:8000'

function App() {
  // State
  const [files, setFiles] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [messages, setMessages] = useState([])
  const [pendingChanges, setPendingChanges] = useState([])
  const [activeChange, setActiveChange] = useState(null)
  const [usage, setUsage] = useState(null)
  const [isTyping, setIsTyping] = useState(false)
  const [currentAgent, setCurrentAgent] = useState(null)
  const [researchResults, setResearchResults] = useState([])
  const [isStopped, setIsStopped] = useState(false)

  // Handle incoming WebSocket messages
  const handleMessage = useCallback((data) => {
    switch (data.type) {
      case 'agent_start':
        setIsTyping(true)
        setCurrentAgent(data)
        break

      case 'thought':
        // Update last message with thoughts
        setMessages(prev => {
          const updated = [...prev]
          if (updated.length > 0 && updated[updated.length - 1].agent === data.agent) {
            updated[updated.length - 1].thoughts =
              (updated[updated.length - 1].thoughts || '') + data.content
          }
          return updated
        })
        break

      case 'message':
        // Update or create message
        setMessages(prev => {
          const updated = [...prev]
          const lastMsg = updated[updated.length - 1]

          if (lastMsg && lastMsg.agent === data.agent && !lastMsg.complete) {
            lastMsg.content += data.content
          } else {
            updated.push({
              id: Date.now(),
              agent: data.agent,
              content: data.content,
              thoughts: '',
              timestamp: new Date(),
              complete: false
            })
          }
          return updated
        })
        break

      case 'handoff':
        // Add handoff indicator
        setMessages(prev => {
          const updated = [...prev]
          if (updated.length > 0) {
            updated[updated.length - 1].complete = true
          }
          updated.push({
            id: Date.now(),
            type: 'handoff',
            from: data.from_agent,
            to: data.to_agent,
            timestamp: new Date()
          })
          return updated
        })
        setCurrentAgent({ name: data.to_agent })
        break

      case 'file_change':
        setPendingChanges(prev => [...prev, data])
        break

      case 'research_results':
        setResearchResults(data.results || [])
        break

      case 'agent_done':
      case 'complete':
        setIsTyping(false)
        setCurrentAgent(null)
        if (data.message && data.message.includes('stopped')) {
          setIsStopped(true)
        }
        setMessages(prev => {
          const updated = [...prev]
          if (updated.length > 0) {
            updated[updated.length - 1].complete = true
          }
          return updated
        })
        fetchUsage()
        break

      case 'error':
        setIsTyping(false)
        setMessages(prev => [...prev, {
          id: Date.now(),
          agent: data.agent,
          content: `❌ Error: ${data.content}`,
          isError: true,
          timestamp: new Date(),
          complete: true
        }])
        break
    }
  }, [])

  // WebSocket connection
  const {
    isConnected,
    sendMessage: wsSend,
    lastMessage,
    stopAgent,
    disconnect
  } = useWebSocket(`ws://localhost:8000/ws/agents`, {
    onMessage: handleMessage
  })

  // API Functions
  const fetchFiles = async () => {
    try {
      const res = await fetch(`${API_URL}/files`)
      const data = await res.json()
      setFiles(data.files || [])
    } catch (err) {
      console.error('Failed to fetch files:', err)
    }
  }

  const fetchUsage = async () => {
    try {
      const res = await fetch(`${API_URL}/usage`)
      const data = await res.json()
      setUsage(data)
    } catch (err) {
      console.error('Failed to fetch usage:', err)
    }
  }

  const uploadFiles = async (fileList) => {
    const formData = new FormData()
    for (const file of fileList) {
      formData.append('files', file)
    }

    try {
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      fetchFiles()
      return data
    } catch (err) {
      console.error('Upload failed:', err)
    }
  }

  const sendChatMessage = useCallback(async (message) => {
    if (!isConnected || !message.trim()) return

    // Add user message
    setMessages(prev => [...prev, {
      id: Date.now(),
      agent: 'User',
      content: message,
      isUser: true,
      timestamp: new Date(),
      complete: true
    }])
    setIsStopped(false)

    let currentFileValid = null
    if (selectedFile) {
      try {
        const res = await fetch(`${API_URL}/files/${selectedFile.path}`)
        if (res.ok) {
          const data = await res.json()
          currentFileValid = {
            path: selectedFile.path,
            content: data.content
          }
        }
      } catch (err) {
        console.error('Failed to fetch selected file content:', err)
      }
    }

    // Send to WebSocket
    wsSend({
      type: 'chat',
      message,
      context: {
        files,
        current_file: currentFileValid
      }
    })
  }, [isConnected, wsSend, files, selectedFile])

  const approveChange = async (changeId, approved) => {
    try {
      await fetch(`${API_URL}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ change_id: changeId, approved })
      })
      setPendingChanges(prev => prev.filter(c => c.change_id !== changeId))
      setActiveChange(null)
      if (approved) fetchFiles()
    } catch (err) {
      console.error('Approval failed:', err)
    }
  }

  const doResearch = async (query) => {
    try {
      const res = await fetch(`${API_URL}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      })
      const data = await res.json()
      setResearchResults(data.search_results || [])
      return data
    } catch (err) {
      console.error('Research failed:', err)
    }
  }

  return (
    <div className="app-container">
      <Header
        isConnected={isConnected}
        usage={usage}
      />

      <Sidebar
        files={files}
        selectedFile={selectedFile}
        onSelectFile={setSelectedFile}
        onUpload={uploadFiles}
      />

      <main className="main-content">
        <AgentChat
          messages={messages}
          isTyping={isTyping}
          currentAgent={currentAgent}
          onSendMessage={sendChatMessage}
          isConnected={isConnected}
          onStop={stopAgent}
          isStopped={isStopped}
        />
      </main>

      <ResearchPanel
        results={researchResults}
        onSearch={doResearch}
      />

      {activeChange && (
        <ApprovalModal
          change={activeChange}
          onApprove={() => approveChange(activeChange.change_id, true)}
          onReject={() => approveChange(activeChange.change_id, false)}
          onClose={() => setActiveChange(null)}
        />
      )}

      {/* Pending changes indicator */}
      {pendingChanges.length > 0 && (
        <div
          className="glass-card"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            cursor: 'pointer'
          }}
          onClick={() => setActiveChange(pendingChanges[0])}
        >
          ⚡ {pendingChanges.length} pending change(s) - Click to review
        </div>
      )}
    </div>
  )
}

export default App
