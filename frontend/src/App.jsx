import { useState, useEffect, useCallback, useRef } from 'react'
import './index.css'

// Components
import Header from './components/Header/Header'
import Sidebar from './components/Sidebar/Sidebar'
import AgentChat from './components/AgentChat/AgentChat'
import ResearchPanel from './components/ResearchPanel/ResearchPanel'
import ChangesPanel from './components/ChangesPanel/ChangesPanel'
import ApprovalModal from './components/ApprovalModal/ApprovalModal'

// Hooks
import { useWebSocket } from './hooks/useWebSocket'

const API_URL = 'http://127.0.0.1:8000'

function App() {
  // State
  const [fileTree, setFileTree] = useState([])
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
  const [workspacePath, setWorkspacePath] = useState(null) // Absolute path to current workspace
  const [activeProject, setActiveProject] = useState(null) // Currently active project (subfolder)

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
          const updated = prev.map(m => ({ ...m, complete: true }))
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
          const updated = prev.map(m => ({ ...m, complete: true }))
          // Add mission completion message if it's the final end of sequence
          if (data.type === 'complete') {
            updated.push({
              id: Date.now(),
              type: 'mission_complete',
              agent: 'System',
              timestamp: new Date()
            })
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
  } = useWebSocket(`ws://127.0.0.1:8000/ws/agents`, {
    onMessage: handleMessage
  })

  // Auto-sync: Poll for file changes every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchFileTree()
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  // API Functions
  const fetchFileTree = async () => {
    try {
      const res = await fetch(`${API_URL}/files`)
      const data = await res.json()
      setFileTree(data.files || [])
      if (data.workspace) {
        setWorkspacePath(data.workspace)
      }
    } catch (err) {
      console.error('❌ [App] Failed to fetch file tree:', err)
    }
  }

  // Open folder picker and set as active workspace
  const openFolder = async () => {
    try {
      console.log('📂 [App] Starting openFolder process...');
      showToast('Opening folder picker...', '📂')

      // Clear current state immediately for a clean "Safe Switch" feel
      setFileTree([])
      setSelectedFile(null)

      // Call backend to open native folder picker
      const res = await fetch(`${API_URL}/select-folder`)
      const data = await res.json()

      if (data.cancelled || !data.path) {
        console.log('⚠️ [App] Folder selection cancelled');
        showToast('Folder selection cancelled', '⚠️')
        // Restore files if cancelled? Actually, keeping it empty is fine, or we could refetch.
        fetchFileTree()
        return
      }

      console.log('🚀 [App] Selected path:', data.path);

      // Set the selected folder as the new workspace
      const setRes = await fetch(`${API_URL}/set-workspace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: data.path })
      })

      if (!setRes.ok) {
        const error = await setRes.json()
        throw new Error(error.detail || 'Failed to set workspace')
      }

      const result = await setRes.json()
      console.log('✅ [App] Workspace updated:', result.workspace);

      // Update state with new workspace (Safe Switch)
      setWorkspacePath(result.workspace)
      setFileTree(result.files || [])
      setSelectedFile(null)
      setAttachedFiles([])
      setActiveProject(null)

      // Extract project name from path for display
      const projectName = data.path.split('\\').pop() || data.path.split('/').pop()
      showToast(`Opened: ${projectName}`, '📂')
      console.log('🎊 [App] Project switched successfully to:', projectName);

    } catch (err) {
      console.error('❌ [App] Open folder failed:', err)
      showToast(`Failed to open folder: ${err.message}`, '❌')
      fetchFileTree() // Try to recover
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

  const uploadFiles = async (fileList, resetWorkspace = false) => {
    // If resetting, clear workspace first
    if (resetWorkspace) {
      // confirm removed as per user request
      await clearWorkspace(true)
    }

    const formData = new FormData()
    let count = 0
    let skipped = 0
    let detectedProject = null

    // Files and folders to exclude
    const EXCLUDED_DIRS = ['node_modules', '.git', 'venv', '.venv', '__pycache__', '.idea', '.vscode', '.DS_Store']

    for (const file of fileList) {
      // Use webkitRelativePath for folder uploads, preserving folder structure
      // Normalize path separators to forward slashes
      let filePath = (file.webkitRelativePath || file.name).replace(/\\/g, '/')

      // Check for excluded directories in the path
      const pathParts = filePath.split('/')
      const isExcluded = pathParts.some(part => EXCLUDED_DIRS.includes(part))

      if (isExcluded) {
        skipped++
        continue
      }

      // Detect project root from first valid file
      if (!detectedProject && pathParts.length > 1) {
        detectedProject = pathParts[0]
      }

      formData.append('files', file)
      formData.append('paths', filePath)
      count++
    }

    if (count === 0) {
      if (skipped > 0) showToast(`Skipped ${skipped} files (system/ignored folders)`, '⚠️')
      return
    }

    showToast(`Uploading ${count} files...`, '📤')
    console.log('📤 [App] Uploading', count, 'files. Reset:', resetWorkspace);

    try {
      // If reset is requested, we detach the current workspace first
      // This prevents the new project from being uploaded INSIDE the old one
      if (resetWorkspace) {
        console.log('🔌 [App] Detaging previous workspace before upload...');
        await fetch(`${API_URL}/detach-workspace`, { method: 'POST' });
      }

      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        throw new Error(`Upload failed: ${res.statusText}`)
      }

      const data = await res.json()
      fetchFileTree()

      // Auto-switch to the newly uploaded project (Safe Switch + Auto Attach)
      if (detectedProject) {
        setActiveProject(detectedProject)

        // Find the absolute path to this project by joining with projects root logic
        // We can get the base path from the result of the upload or just rely on the backend 
        // resolving 'projects/projectName' correctly.
        const projectPath = `projects/${detectedProject}`;
        console.log('🔗 [App] Auto-attaching backend to new project:', projectPath);

        try {
          await fetch(`${API_URL}/set-workspace`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: projectPath })
          });
          fetchFileTree();
        } catch (err) {
          console.error('Failed to auto-attach workspace:', err);
        }

        showToast(`Switched to project: ${detectedProject}`, '📂')
      }

      showToast(`Successfully uploaded ${data.count} files`, '✅')
      return data
    } catch (err) {
      console.error('Upload failed:', err)
      showToast('Upload failed', '❌')
    }
  }

  const showToast = useCallback((message, icon = '⚠️') => {
    // Use a more unique ID generation strategy to prevent collisions
    const id = Date.now() + Math.random().toString(36).substr(2, 9)
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

    // Add user message and mark ALL previous as complete
    setMessages(prev => [
      ...prev.map(m => ({ ...m, complete: true })),
      {
        id: Date.now(),
        agent: 'User',
        content: message,
        isUser: true,
        timestamp: new Date(),
        complete: true
      }
    ])
    setIsStopped(false)

    let currentFileValid = null
    if (selectedFile) {
      try {
        const encodedPath = selectedFile.path.replace(/\//g, '%2F')
        const res = await fetch(`${API_URL}/files/${encodedPath}`)
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
        files: fileTree,
        current_file: currentFileValid,
        attached_files: attachedFiles
      }
    })
  }, [isConnected, wsSend, fileTree, selectedFile, attachedFiles])

  // Clear workspace (UI state only - files remain on disk)
  const clearWorkspace = async (skipConfirm = false) => {
    if (!skipConfirm && !confirm('Clear current view? Files will remain saved on disk.')) return

    // DETACH backend so it stops looking at these files
    try {
      await fetch(`${API_URL}/detach-workspace`, { method: 'POST' })
    } catch (err) {
      console.error('Failed to detach workspace:', err)
    }

    setFileTree([])
    setSelectedFile(null)
    setAttachedFiles([])
    setMessages([])
    setPendingChanges([])
    setApprovedChanges([])
    setResearchResults([])
    setActiveProject(null) // Reset active project
    setWorkspacePath(null) // Clear workspace path
    showToast('Workspace view cleared', '🧹')
    console.log('🧹 [App] Workspace state and backend detached.');
  }

  const createFile = async (filePath) => {
    console.log('🛠️ App.createFile called with:', filePath)
    try {
      const res = await fetch(`${API_URL}/create-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: '' })
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.detail || 'Failed to create file')
      }

      fetchFileTree()
      showToast(`Created ${filePath}`, '📄')
    } catch (err) {
      console.error('Create file failed:', err)
      showToast(err.message, '❌')
    }
  }

  const createFolder = async (folderPath) => {
    try {
      const formData = new FormData()
      formData.append('path', folderPath)

      const res = await fetch(`${API_URL}/create-folder`, {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.detail || 'Failed to create folder')
      }

      fetchFileTree()
      showToast(`Created folder ${folderPath}`, '📂')
    } catch (err) {
      console.error('Create folder failed:', err)
      showToast(err.message, '❌')
    }
  }

  const uploadToPath = async (fileList, targetPath) => {
    const formData = new FormData()
    let count = 0

    for (const file of fileList) {
      const filePath = `${targetPath}/${file.name}`
      formData.append('files', file)
      formData.append('paths', filePath)
      count++
    }

    if (count === 0) return

    try {
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        throw new Error(`Upload failed: ${res.statusText}`)
      }

      fetchFileTree()
      showToast(`Added ${count} file(s) to ${targetPath}`, '✅')
    } catch (err) {
      console.error('Upload to path failed:', err)
      showToast('Failed to upload files', '❌')
    }
  }

  // Move file or folder within workspace
  const moveItem = async (sourcePath, destinationFolder) => {
    try {
      const res = await fetch(`${API_URL}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_path: sourcePath,
          destination_folder: destinationFolder
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.detail || 'Move failed')
      }

      const data = await res.json()
      fetchFileTree()
      showToast(`Moved to ${destinationFolder}`, '✅')
      return data
    } catch (err) {
      console.error('Move failed:', err)
      showToast(`Move failed: ${err.message}`, '❌')
    }
  }

  const renameItem = async (path, newName) => {
    try {
      const res = await fetch(`${API_URL}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, new_name: newName })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.detail || 'Rename failed')
      }

      fetchFileTree()
      showToast(`Renamed to ${newName}`, '✏️')
    } catch (err) {
      console.error('Rename failed:', err)
      showToast(`Rename failed: ${err.message}`, '❌')
    }
  }

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

      if (approved) fetchFileTree()

      // Signal orchestration to resume
      wsSend({
        type: 'approval_done',
        approved,
        feedback,
        context: {
          files: fileTree,
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
        files={fileTree}
        selectedFile={selectedFile}
        onSelectFile={setSelectedFile}
        onUpload={uploadFiles}
        onAttachFiles={attachFiles}
        onClearWorkspace={clearWorkspace}
        onCreateFile={createFile}
        onCreateFolder={createFolder}
        onUploadToPath={uploadToPath}
        onMoveItem={moveItem}
        onRenameItem={renameItem}
        onOpenFolder={openFolder}
        workspacePath={workspacePath}
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
