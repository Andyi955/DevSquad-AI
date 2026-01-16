import { useState, useEffect, useCallback, useRef } from 'react'
import './index.css'

// Components
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import AgentChat from './components/AgentChat'
import ResearchPanel from './components/ResearchPanel'
import ChangesPanel from './components/ChangesPanel'
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
  const [approvedChanges, setApprovedChanges] = useState([]) // New state for history
  const [activeChange, setActiveChange] = useState(null)
  const [usage, setUsage] = useState(null)
  const [isTyping, setIsTyping] = useState(false)
  const [currentAgent, setCurrentAgent] = useState(null)
  const [researchResults, setResearchResults] = useState([])
  const [isStopped, setIsStopped] = useState(false)
  const [toasts, setToasts] = useState([])
  const [attachedFiles, setAttachedFiles] = useState([])
  const [rightPanelTab, setRightPanelTab] = useState('research')
  const [isChangesFullScreen, setIsChangesFullScreen] = useState(false)

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
          // Find the last real message (not status/handoff) from this agent
          let lastMsg = null
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].agent === data.agent && !updated[i].type) {
              lastMsg = updated[i]
              break
            }
          }

          if (lastMsg && !lastMsg.complete) {
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
        setPendingChanges(prev => {
          // Prevent duplicates: check if change_id already exists
          const exists = prev.some(c => c.change_id === data.change_id || c.id === data.change_id);
          if (exists) return prev;
          return [...prev, data];
        })
        setRightPanelTab('changes') // Automatically switch to changes tab
        break

      case 'message_update':
        if (data.concise_message) {
          setMessages(prev => {
            const updated = [...prev]
            // Find the last non-user message
            for (let i = updated.length - 1; i >= 0; i--) {
              if (!updated[i].isUser && updated[i].type !== 'handoff') {
                updated[i].concise_message = data.concise_message
                // Mark as having a concise version
                break
              }
            }
            return updated
          })
        }
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

      case 'agent_status':
        setMessages(prev => [...prev, {
          id: Date.now(),
          type: 'agent_status',
          status: data.status,
          timestamp: new Date()
        }])
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

  const showToast = useCallback((message, icon = '⚠️') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, icon }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  const attachFiles = useCallback(async (filesToAttach) => {
    const filesArray = Array.isArray(filesToAttach) ? filesToAttach : [filesToAttach]
    const newAttachments = []

    for (const file of filesArray) {
      if (attachedFiles.find(f => f.path === file.path)) continue

      try {
        const res = await fetch(`${API_URL}/files/${file.path.replace(/\//g, '%2F')}`)
        if (res.ok) {
          const data = await res.json()
          newAttachments.push({
            path: file.path,
            content: data.content,
            extension: file.extension
          })
        }
      } catch (err) {
        console.error(`Failed to attach ${file.path}:`, err)
      }
    }

    if (newAttachments.length > 0) {
      setAttachedFiles(prev => [...prev, ...newAttachments])
      showToast(`Attached ${newAttachments.length} file(s)`, '📎')
    }
  }, [attachedFiles, showToast])

  const removeAttachedFile = useCallback((path) => {
    setAttachedFiles(prev => prev.filter(f => f.path !== path))
  }, [])

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
        current_file: currentFileValid,
        attached_files: attachedFiles
      }
    })
  }, [isConnected, wsSend, files, selectedFile, attachedFiles])

  const approveChange = async (changeId, approved, feedback = null) => {
    try {
      const res = await fetch(`${API_URL}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ change_id: changeId, approved })
      })
      const data = await res.json()

      if (data.status === 'failed' || data.error) {
        throw new Error(data.error || 'Approval failed on backend')
      }

      // Move to approvedChanges if approved, or just remove if rejected
      setPendingChanges(prev => {
        const changeToMove = prev.find(c => c.change_id === changeId || c.id === changeId);
        if (approved && changeToMove) {
          setApprovedChanges(approvals => [changeToMove, ...approvals].slice(0, 50)); // Keep last 50
        }
        return prev.filter(c => (c.change_id !== changeId && c.id !== changeId));
      })

      setActiveChange(null)
      setIsChangesFullScreen(false) // Auto-close full screen view

      if (approved) fetchFiles()

      // Signal orchestration to resume
      wsSend({
        type: 'approval_done',
        approved,
        feedback,
        context: {
          files,
          current_file: selectedFile ? {
            path: selectedFile.path,
            content: await fetch(`${API_URL}/files/${selectedFile.path.replace(/\//g, '%2F')}`)
              .then(res => res.json())
              .then(data => data.content)
              .catch(() => null)
          } : null,
          attached_files: attachedFiles
        }
      })
    } catch (err) {
      console.error('Approval failed:', err)
      showToast(`Action failed: ${err.message}`, '❌')
    }
  }

  const approveAllChanges = async () => {
    if (pendingChanges.length === 0) return

    // Copy pending changes to avoid issues during iteration
    const changesToApprove = [...pendingChanges]

    // We could potentially add a bulk approve endpoint on the backend, 
    // but for now, we'll iterate
    for (const change of changesToApprove) {
      await approveChange(change.change_id || change.id, true)
    }

    showToast(`Approved all ${changesToApprove.length} changes!`, '✅')
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
        onAttachFiles={attachFiles}
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
          attachedFiles={attachedFiles}
          onAttachFiles={attachFiles}
          onRemoveFile={removeAttachedFile}
          onShowChanges={() => setRightPanelTab('changes')}
        />
      </main>

      <aside className="research-panel-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', borderLeft: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
        <div className="panel-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
          <button
            className={`panel-tab ${rightPanelTab === 'research' ? 'active' : ''}`}
            onClick={() => setRightPanelTab('research')}
            style={{
              flex: 1,
              padding: '12px',
              background: rightPanelTab === 'research' ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
              color: rightPanelTab === 'research' ? 'var(--neon-cyan)' : 'var(--text-muted)',
              border: 'none',
              borderBottom: rightPanelTab === 'research' ? '2px solid var(--neon-cyan)' : 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            🔍 Research
          </button>
          <button
            className={`panel-tab ${rightPanelTab === 'changes' ? 'active' : ''}`}
            onClick={() => setRightPanelTab('changes')}
            style={{
              flex: 1,
              padding: '12px',
              background: rightPanelTab === 'changes' ? 'rgba(147, 51, 234, 0.1)' : 'transparent',
              color: rightPanelTab === 'changes' ? 'var(--neon-purple)' : 'var(--text-muted)',
              border: 'none',
              borderBottom: rightPanelTab === 'changes' ? '2px solid var(--neon-purple)' : 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              position: 'relative'
            }}
          >
            ⚡ Changes
            {pendingChanges.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '6px',
                right: '12px',
                background: 'var(--neon-purple)',
                color: 'white',
                fontSize: '0.65rem',
                padding: '1px 5px',
                borderRadius: '10px',
                boxShadow: '0 0 5px var(--neon-purple)'
              }}>
                {pendingChanges.length}
              </span>
            )}
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'hidden' }}>
          {rightPanelTab === 'research' ? (
            <ResearchPanel
              results={researchResults}
              onSearch={doResearch}
            />
          ) : (
            <ChangesPanel
              pendingChanges={pendingChanges}
              approvedChanges={approvedChanges}
              onApprove={(id) => approveChange(id, true)}
              onReject={(id) => approveChange(id, false)}
              onApproveAll={approveAllChanges}
              isFullScreen={false}
              onToggleFullScreen={() => setIsChangesFullScreen(true)}
            />
          )}
        </div>
      </aside>

      {activeChange && (
        <ApprovalModal
          change={activeChange}
          onApprove={() => approveChange(activeChange.change_id, true)}
          onReject={() => approveChange(activeChange.change_id, false)}
          onClose={() => setActiveChange(null)}
        />
      )}

      {/* Full Screen Changes Panel */}
      {isChangesFullScreen && (
        <ChangesPanel
          pendingChanges={pendingChanges}
          approvedChanges={approvedChanges}
          onApprove={(id) => approveChange(id, true)}
          onReject={(id) => approveChange(id, false)}
          onApproveAll={approveAllChanges}
          isFullScreen={true}
          onToggleFullScreen={() => setIsChangesFullScreen(false)}
        />
      )}

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className="toast">
            <span className="toast-icon">{toast.icon}</span>
            <span className="toast-message">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
