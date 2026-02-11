import { useState, useEffect, useCallback, useRef } from 'react'
import './index.css'

// Components
import Header from './components/Header/Header'
import Sidebar from './components/Sidebar/Sidebar'
import AgentChat from './components/AgentChat/AgentChat'
import ResearchPanel from './components/ResearchPanel/ResearchPanel'
import ChangesPanel from './components/ChangesPanel/ChangesPanel'
import ApprovalModal from './components/ApprovalModal/ApprovalModal'
import DeepResearchView from './components/ResearchPanel/DeepResearchView'
import TimelineView from './components/Timeline/TimelineView'
import TerminalComponent from './components/Terminal' // Import Terminal
import './components/ResizeHandles.css' // Layout Resizing
import Dashboard from './pages/Dashboard'
import TaskPanel from './components/TaskPanel/TaskPanel'
import ConfirmationModal from './components/ConfirmationModal/ConfirmationModal'
import HistoryPanel from './components/HistoryPanel/HistoryPanel'
import BenchmarkDashboard from './components/BenchmarkDashboard/BenchmarkDashboard'


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
  const [rightPanelTab, setRightPanelTab] = useState('changes') // research or changes
  const [isChangesFullScreen, setIsChangesFullScreen] = useState(false)
  const [workspacePath, setWorkspacePath] = useState(null) // Absolute path to current workspace
  const [activeProject, setActiveProject] = useState(null) // Currently active project (subfolder)
  const [mainTab, setMainTab] = useState('chat') // chat or deep-research
  const [isDeepResearching, setIsDeepResearching] = useState(false)
  const [currentResearchStatus, setCurrentResearchStatus] = useState('')
  const [researchReport, setResearchReport] = useState(null)
  const [timeline, setTimeline] = useState([]) // New activity timeline
  const [hasTerminalActivity, setHasTerminalActivity] = useState(false) // Notification dot for terminal
  const [pendingPlan, setPendingPlan] = useState(null) // Pending task plan for approval
  const [modalConfirm, setModalConfirm] = useState({
    isOpen: false,
    title: '',
    message: '',
    itemPath: '',
    confirmText: 'Confirm',
    onConfirm: null,
    isDanger: true,
    coords: null
  })

  // Layout State
  const [leftPanelWidth, setLeftPanelWidth] = useState(260)
  const [rightPanelWidth, setRightPanelWidth] = useState(320)
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false)
  const [isRightCollapsed, setIsRightCollapsed] = useState(false)
  const [isResizingLeft, setIsResizingLeft] = useState(false)
  const [isResizingRight, setIsResizingRight] = useState(false)

  // Resizing Logic
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizingLeft) {
        const newWidth = e.clientX
        if (newWidth > 150 && newWidth < 600) setLeftPanelWidth(newWidth)
      }
      if (isResizingRight) {
        const newWidth = window.innerWidth - e.clientX
        if (newWidth > 200 && newWidth < 800) setRightPanelWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizingLeft(false)
      setIsResizingRight(false)
      document.body.style.cursor = 'default'
      document.body.style.userSelect = 'auto'
    }

    if (isResizingLeft || isResizingRight) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingLeft, isResizingRight])


  // Handle incoming WebSocket messages
  const handleMessage = useCallback((data) => {
    switch (data.type) {
      case 'agent_start':
        setIsTyping(true)
        setCurrentAgent(data)
        setTimeline(prev => [{
          id: `start-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'agent_start',
          message: `${data.agent} started working`,
          agent: data.agent,
          timestamp: new Date()
        }, ...prev].slice(0, 50))
        break

      case 'thought':
        setMessages(prev => {
          // Find the index of the message to update
          const index = prev.findLastIndex(m => m.agent === data.agent && !m.complete);

          if (index !== -1) {
            // Immutable update: create a new array and a new object for the updated message
            const updated = [...prev];
            updated[index] = {
              ...updated[index],
              thoughts: (updated[index].thoughts || '') + (data.content || '')
            };
            return updated;
          } else {
            // Create a new message shell if not found
            return [...prev, {
              id: `thought-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              agent: data.agent,
              content: '',
              thoughts: data.content || '',
              timestamp: new Date(),
              complete: false
            }];
          }
        })
        break

      case 'message':
        setMessages(prev => {
          const index = prev.findLastIndex(m => m.agent === data.agent && !m.complete);

          if (index !== -1) {
            const updated = [...prev];
            updated[index] = {
              ...updated[index],
              content: (updated[index].content || '') + (data.content || '')
            };
            return updated;
          } else {
            return [...prev, {
              id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              agent: data.agent,
              content: data.content || '',
              thoughts: '',
              timestamp: new Date(),
              complete: false
            }];
          }
        })
        break

      case 'handoff':
        // Add handoff indicator
        setMessages(prev => {
          const updated = prev.map(m => ({ ...m, complete: true }))
          updated.push({
            id: `handoff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'handoff',
            from: data.from_agent,
            to: data.to_agent,
            timestamp: new Date()
          })
          return updated
        })
        setCurrentAgent({ name: data.to_agent })
        setTimeline(prev => [{
          id: `handoff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'handoff',
          message: `Passing project to ${data.to_agent}`,
          agent: 'System',
          timestamp: new Date()
        }, ...prev].slice(0, 50))
        break

      case 'file_change':
        setPendingChanges(prev => {
          // Prevent duplicates: check if change_id already exists
          const exists = prev.some(c => c.change_id === data.change_id || c.id === data.change_id);
          if (exists) return prev;
          return [...prev, data];
        })
        setRightPanelTab('changes') // Automatically switch to changes tab
        setTimeline(prev => [{
          id: `edit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'edit',
          message: `Proposed ${data.action} for ${data.path}`,
          agent: data.agent,
          timestamp: new Date()
        }, ...prev].slice(0, 50))
        break

      case 'message_update':
        if (data.concise_message) {
          setMessages(prev => {
            const index = prev.findLastIndex(m => !m.isUser && m.type !== 'handoff');
            if (index !== -1) {
              const updated = [...prev];
              updated[index] = {
                ...updated[index],
                concise_message: data.concise_message,
                is_technical: data.is_technical
              };
              return updated;
            }
            return prev;
          })
        }
        break

      case 'agent_status':
        // Update research status if we are researching (but don't force tab switch)
        const statusLower = data.status?.toLowerCase() || '';
        if (statusLower.includes('research') || statusLower.includes('search') || statusLower.includes('synthesis') || statusLower.includes('analyz')) {
          setCurrentResearchStatus(data.status)
          setIsDeepResearching(true)
          // Removed: automatic tab switch to keep chat and research separate as requested
        }

        // Still add to messages for the log
        setMessages(prev => [...prev, {
          id: `status-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'agent_status',
          status: data.status,
          agent: data.agent,
          timestamp: new Date()
        }])

        setTimeline(prev => [{
          id: `status-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'status',
          message: data.status,
          agent: data.agent || 'System',
          timestamp: new Date()
        }, ...prev].slice(0, 50))
        break

      case 'research_report':
        setResearchReport(data.content)
        break

      case 'dev_log':
        // Show in console for depth
        console.log(`%c[${data.level?.toUpperCase() || 'INFO'}] %c${data.message}`,
          'color: #00ff88; font-weight: bold;',
          'color: #ffffff;');

        // Also show as a temporary toast/badge if it's a cue
        if (data.message.includes('triggered cues')) {
          showToast(data.message.split('triggered cues: ')[1], '🎯')
        }
        break

      case 'research_results':
        setResearchResults(data.results)
        // Keep researching for synthesis
        break

      case 'plan_created':
        // Planner Agent generated a new task plan
        setPendingPlan(data.plan)
        showToast('📋 New task plan created! Review in Tasks tab', '📋')
        // Switch to tasks tab to show the plan
        setMainTab('tasks')
        break

      case 'agent_done':
      case 'complete':
        setIsTyping(false)
        setCurrentAgent(null)
        setIsDeepResearching(false)
        if (data.message && data.message.includes('stopped')) {
          setIsStopped(true)
        }
        setMessages(prev => {
          const updated = prev.map(m => ({ ...m, complete: true }));
          // Only show mission complete card if it's explicitly final
          // Project completion card removed as requested
          return updated;
        })
        fetchUsage()
        break

      case 'error':
        setIsTyping(false)
        if (data.isTimeout) {
          // It's a timeout, show the continue prompt logic in AgentChat
          // We can signal this by passing a special flag or just letting the user see the error + Retry button
          // But AgentChat handles 'showContinuePrompt' internally via props or local state.
          // Since showContinuePrompt is local to AgentChat, we might need to expose it or just let the error message represent the state.
          // Actually, AgentChat has no prop to force showContinuePrompt from App.jsx, it has onStop/onSendMessage.
          // Let's just treat it as a stopped state so the user can hit continue.
          setIsStopped(true)
        }

        setMessages(prev => [...prev, {
          id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          agent: data.agent,
          content: data.isTimeout ? `Construction Timed Out: ${data.content}` : `❌ Error: ${data.content}`,
          isError: true,
          isTimeout: data.isTimeout, // Pass this through
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

  // Optimistic Stop Handler
  const handleStopAgent = useCallback(() => {
    console.log('🛑 [App] User requested stop - updating UI immediately');
    stopAgent()
    // Optimistic state updates
    setIsTyping(false)
    setIsDeepResearching(false)
    setIsStopped(true)
    // We keep currentAgent briefly so the chat doesn't jump, 
    // but the typing indicator logic in AgentChat depends on isTyping, so it will hide.
  }, [stopAgent])

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

  // Fetch pending plan for Tasks tab notification
  const fetchPlan = async () => {
    try {
      const res = await fetch(`${API_URL}/api/plan/current`)
      const data = await res.json()
      setPendingPlan(data.plan)
    } catch (err) {
      // Plan endpoint may not exist yet
    }
  }

  // Poll for plan updates
  useEffect(() => {
    fetchPlan()
    const interval = setInterval(fetchPlan, 5000)
    return () => clearInterval(interval)
  }, [])

  // Load chat history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await fetch(`${API_URL}/api/history`)
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          console.log(`📜 [App] Loaded ${data.length} messages from history`)
          setMessages(data.map(m => ({
            ...m,
            id: `hist-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(m.timestamp),
            complete: true
          })))
        }
      } catch (err) {
        console.error('Failed to load history:', err)
      }
    }
    loadHistory()
  }, [])

  const uploadFiles = async (fileList, resetWorkspace = false) => {
    console.log('🚀 [App] uploadFiles called. Files:', fileList.length, 'Reset:', resetWorkspace);

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

        // Use the absolute path returned by backend if available, otherwise fallback
        const projectPath = data.project_path || `projects/${detectedProject}`;
        console.log('🔗 [App] Auto-attaching backend to new project:', projectPath);
        console.log('🔗 [App] Backend returned project_path:', data.project_path);
        console.log('🔗 [App] Detected local project name:', detectedProject);

        try {
          const setWorkspaceRes = await fetch(`${API_URL}/set-workspace`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: projectPath })
          });

          if (!setWorkspaceRes.ok) {
            const errText = await setWorkspaceRes.text();
            console.error('❌ [App] set-workspace failed:', errText);
          } else {
            console.log('✅ [App] set-workspace success');
          }

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

  const sendChatMessage = useCallback(async (message, switchTab = true) => {
    if (!isConnected || !message.trim()) return

    // Chat can proceed without a workspace.

    // Add user message and mark ALL previous as complete
    setMessages(prev => [
      ...prev.map(m => ({ ...m, complete: true })),
      {
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

    if (switchTab) {
      setMainTab('chat')
    }
    setAttachedFiles([])
  }, [isConnected, wsSend, fileTree, selectedFile, attachedFiles])

  // Clear workspace (UI state only - files remain on disk)
  const clearWorkspace = async (skipConfirm = false, event = null) => {
    if (!skipConfirm) {
      const rect = event?.currentTarget.getBoundingClientRect()
      setModalConfirm({
        isOpen: true,
        title: 'Clear',
        message: 'Clear view?',
        confirmText: 'Clear',
        isDanger: false,
        onConfirm: () => executeClearWorkspace(),
        coords: rect ? {
          top: rect.top - 48,
          left: rect.right - 180, // Align right edge roughly
          transform: 'none'
        } : null
      })
      return
    }
    executeClearWorkspace()
  }

  const executeClearWorkspace = async () => {
    setModalConfirm(prev => ({ ...prev, isOpen: false }))

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
  const deleteItem = (path, event = null) => {
    const rect = event?.currentTarget.getBoundingClientRect()
    setModalConfirm({
      isOpen: true,
      title: 'Delete',
      message: 'Delete?',
      itemPath: path,
      confirmText: 'Delete',
      isDanger: true,
      onConfirm: () => executeDeletion(path),
      coords: rect ? {
        top: rect.top - 48,
        left: rect.right - 220, // Align right edge
        transform: 'none'
      } : null
    })
  }

  const executeDeletion = async (path) => {
    setModalConfirm(prev => ({ ...prev, isOpen: false }))

    try {
      console.log('📤 [App] Sending delete request for:', path)
      const res = await fetch(`${API_URL}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.detail || 'Delete failed')
      }

      console.log('✅ [App] Delete successful for:', path)
      fetchFileTree()
      showToast(`Deleted ${path}`, '🗑️')
      if (selectedFile?.path === path) setSelectedFile(null)
    } catch (err) {
      console.error('❌ [App] Delete failed:', err)
      showToast(`Delete failed: ${err.message}`, '❌')
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

  // Clear current chat session
  const handleNewChat = useCallback(async () => {
    try {
      await fetch(`${API_URL}/clear-chat`, { method: 'POST' })
      setMessages([])
      setPendingChanges([])
      setApprovedChanges([])
      setResearchResults([])
      setResearchReport(null)
      setAttachedFiles([])
      setIsTyping(false)
      setCurrentAgent(null)
      setIsStopped(false)
      showToast('Chat Reset ✨', '🏙️')
    } catch (err) {
      console.error('Failed to clear chat:', err)
      showToast('Failed to reset chat', '❌')
    }
  }, [showToast])

  const loadSession = async (session) => {
    try {
      const res = await fetch(`${API_URL}/api/history/${session.id}/load`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.status === 'success') {
        const mappedMessages = data.history.map(m => ({
          agent: m.agent,
          content: m.content,
          thoughts: m.thoughts,
          timestamp: m.timestamp,
          isUser: m.agent === 'User',
          isTechnical: m.is_technical
        }));
        setMessages(mappedMessages);
        showToast(`Loaded session: ${session.title}`, '📂');
      }
    } catch (err) {
      console.error('Failed to load session:', err);
      showToast('Failed to load session', '❌');
    }
  };

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

  const doResearch = useCallback((query) => {
    if (!isConnected || !query.trim()) {
      console.log('❌ [App] Cannot start research - not connected or empty query')
      return
    }

    // Deep research doesn't strictly need a workspace as it's primarily web-based.

    console.log('🔬 [App] Starting deep research via WebSocket:', query)

    // Reset previous results
    setResearchResults([])
    setResearchReport(null)
    setIsDeepResearching(true)
    setCurrentResearchStatus('Initializing deep research...')

    // Add user message to chat
    setMessages(prev => [
      ...prev.map(m => ({ ...m, complete: true })),
      {
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        agent: 'User',
        content: `🔬 Deep Research: ${query}`,
        isUser: true,
        timestamp: new Date(),
        complete: true
      }
    ])

    // Send via WebSocket - this triggers orchestrator.do_research()
    wsSend({
      type: 'research',
      query: query.trim()
    })
  }, [isConnected, wsSend])

  return (
    <div className="app-container">
      <Header
        isConnected={isConnected}
        usage={usage}
        onNewChat={handleNewChat}
        activeTab={mainTab}
        onTabChange={setMainTab}
        hasPendingPlan={pendingPlan && pendingPlan.status === 'pending_approval'}
      />

      <div className="workspace-layout">
        <div style={{ position: 'relative', display: 'flex', height: '100%' }}>
          <div
            className={`sidebar-container ${isLeftCollapsed ? 'collapsed' : ''}`}
            style={{
              width: isLeftCollapsed ? '0px' : leftPanelWidth,
              transition: isResizingLeft ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              overflow: 'hidden',
              flexShrink: 0,
              background: 'var(--bg-secondary)',
              borderRight: '1px solid var(--border-color)',
              position: 'relative'
            }}
          >
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
              onDeleteItem={deleteItem}
              onOpenFolder={openFolder}
              workspacePath={workspacePath}
            />
          </div>

          {!isLeftCollapsed && (
            <div
              className="resize-handle left"
              onMouseDown={() => setIsResizingLeft(true)}
              style={{
                width: '4px',
                cursor: 'col-resize',
                background: isResizingLeft ? 'var(--neon-cyan)' : 'transparent',
                height: '100%',
                position: 'absolute',
                right: '-2px',
                zIndex: 100,
                transition: 'background 0.2s',
              }}
            />
          )}

          <button
            className="panel-toggle-btn left"
            onClick={() => setIsLeftCollapsed(!isLeftCollapsed)}
            style={{
              position: 'absolute',
              top: '50%',
              left: isLeftCollapsed ? '12px' : `${leftPanelWidth - 12}px`,
              transform: 'translateY(-50%)',
              zIndex: 101,
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            {isLeftCollapsed ? '›' : '‹'}
          </button>
        </div>

        <main className="main-content" style={{ minWidth: 0 }}>
          <div className="main-tabs">
            <button
              className={`main-tab-btn chat ${mainTab === 'chat' ? 'active' : ''}`}
              onClick={() => setMainTab('chat')}
            >
              💬 CO-DEV CHAT
            </button>
            <button
              className={`main-tab-btn research ${mainTab === 'deep-research' ? 'active' : ''}`}
              onClick={() => setMainTab('deep-research')}
            >
              🕵️‍♂️ DEEP RESEARCH
              {isDeepResearching && <span className="pulse-dot active"></span>}
            </button>
            <button
              className={`main-tab-btn timeline ${mainTab === 'timeline' ? 'active' : ''}`}
              onClick={() => setMainTab('timeline')}
            >
              📜 LIVE TIMELINE
            </button>
            <button
              className={`main-tab-btn terminal ${mainTab === 'terminal' ? 'active' : ''}`}
              onClick={() => { setMainTab('terminal'); setHasTerminalActivity(false); }}
            >
              💻 TERMINAL
              {hasTerminalActivity && <span className="pulse-dot active" style={{ backgroundColor: '#ff5555' }}></span>}
            </button>
            <button
              className={`main-tab-btn benchmarks ${mainTab === 'benchmarks' ? 'active' : ''}`}
              onClick={() => setMainTab('benchmarks')}
            >
              📊 BENCHMARKS
            </button>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            {mainTab === 'dashboard' ? (
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <Dashboard />
              </div>
            ) : mainTab === 'tasks' ? (
              <div style={{ flex: 1, overflow: 'hidden', padding: '20px' }}>
                <TaskPanel
                  onPlanApproved={(plan) => {
                    setPendingPlan(plan);
                    setMainTab('chat');
                    sendChatMessage("The task plan has been approved. Please begin work on the first task. 🚀");
                  }}
                  onSendFeedback={(message) => {
                    // Send message and stay on tasks tab to see the plan update
                    sendChatMessage(message, false);
                  }}
                />
              </div>
            ) : mainTab === 'chat' ? (
              <AgentChat
                messages={messages}
                isTyping={isTyping}
                currentAgent={currentAgent}
                onSendMessage={sendChatMessage}
                isConnected={isConnected}
                onStop={handleStopAgent}
                isStopped={isStopped}
                attachedFiles={attachedFiles}
                onAttachFiles={attachFiles}
                onRemoveFile={removeAttachedFile}
                onShowChanges={() => setRightPanelTab('changes')}
                onRate={(msg, rating) => {
                  fetch('http://127.0.0.1:8000/api/rate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      message_id: msg.id,
                      agent_name: msg.agent,
                      content: msg.content,
                      rating: rating,
                      feedback: null
                    })
                  }).catch(err => console.error("Failed to save rating:", err));
                }}
                onRunCommand={(cmd) => {
                  // Send command to backend terminal
                  // We need a way to send this to the terminal websocket or a separate endpoint
                  // Ideally we reuse the existing terminal connection if possible, or just hit an endpoint
                  // For simplicity, let's use the existing chat websocket if it supports it, 
                  // OR better, directly use the TerminalComponent's websocket via a context/ref?
                  // actually, let's just use a simple POST request to a new endpoint which writes to PTY
                  // because the WebSocket ref is inside TerminalComponent.
                  // Or we can add a helper in App.jsx to send via a new socket.

                  // Simpler: Trigger a function that finds the terminal websocket.
                  // But TerminalComponent has its own WS. 
                  // Let's use a custom event or passed down ref?
                  // Ref is cleaner.
                  if (window.terminalWs && window.terminalWs.readyState === WebSocket.OPEN) {
                    window.terminalWs.send(JSON.stringify({ type: 'input', data: cmd + '\r' }));
                    // Switch to terminal tab so user sees it
                    setMainTab('terminal');
                    setHasTerminalActivity(false);
                  } else {
                    // Fallback or error
                    console.error("Terminal not connected");
                    // Try to re-establish or alert
                    const tempWs = new WebSocket('ws://127.0.0.1:8000/ws/terminal');
                    tempWs.onopen = () => {
                      tempWs.send(JSON.stringify({ type: 'input', data: cmd + '\r' }));
                      tempWs.close(); // Just one-off? No, we need output.
                      // Actually, if Terminal is persistent (hidden), its WS should be open.
                      // We just need access to it.
                    };
                    setMainTab('terminal'); // Forcing tab switch usually reconnects if it was closed
                  }
                }}
              />
            ) : mainTab === 'timeline' ? (
              <TimelineView timeline={timeline} />
            ) : mainTab === 'benchmarks' ? (
              <BenchmarkDashboard />
            ) : (
              // Deep Research View
              (mainTab === 'deep-research') && (
                <DeepResearchView
                  results={researchResults}
                  isResearching={isDeepResearching}
                  currentStatus={currentResearchStatus}
                  report={researchReport}
                  onSearch={doResearch}
                />
              )
            )}

            {/* Persistent Terminal Component */}
            <div style={{
              display: mainTab === 'terminal' ? 'block' : 'none',
              height: '100%',
              width: '100%'
            }}>
              <TerminalComponent
                isActive={mainTab === 'terminal'}
                onActivity={() => {
                  if (mainTab !== 'terminal') {
                    setHasTerminalActivity(true)
                  }
                }}
              />
            </div>
          </div>
        </main>

        <div style={{ position: 'relative', display: 'flex', height: '100%', flexShrink: 0 }}>

          {!isRightCollapsed && (
            <div
              className="resize-handle right"
              onMouseDown={() => setIsResizingRight(true)}
              style={{
                width: '4px',
                cursor: 'col-resize',
                background: isResizingRight ? 'var(--neon-purple)' : 'transparent',
                height: '100%',
                position: 'absolute',
                left: '-2px',
                zIndex: 100,
                transition: 'background 0.2s',
              }}
            />
          )}

          <button
            className="panel-toggle-btn right"
            onClick={() => setIsRightCollapsed(!isRightCollapsed)}
            style={{
              position: 'absolute',
              top: '50%',
              left: isRightCollapsed ? '-36px' : '-12px',
              transform: 'translateY(-50%)',
              zIndex: 101,
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            {isRightCollapsed ? '‹' : '›'}
          </button>

          <aside
            className={`research-panel-container ${isRightCollapsed ? 'collapsed' : ''}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              borderLeft: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              width: isRightCollapsed ? '0px' : rightPanelWidth,
              transition: isResizingRight ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              overflow: 'hidden',
              flexShrink: 0,
              position: 'relative'
            }}
          >
            <div className="panel-tabs" style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-color)',
              height: '48px',
              alignItems: 'stretch',
              padding: '0',
              flexShrink: 0
            }}>
              <button
                onClick={() => setRightPanelTab('changes')}
                style={{
                  flex: 1,
                  background: rightPanelTab === 'changes' ? 'rgba(147, 51, 234, 0.05)' : 'transparent',
                  border: 'none',
                  borderBottom: rightPanelTab === 'changes' ? '2px solid var(--neon-purple)' : '2px solid transparent',
                  color: rightPanelTab === 'changes' ? 'var(--text-main)' : 'var(--text-muted)',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                🛠️ CHANGES
              </button>
              <button
                onClick={() => setRightPanelTab('history')}
                style={{
                  flex: 1,
                  background: rightPanelTab === 'history' ? 'rgba(0, 255, 136, 0.05)' : 'transparent',
                  border: 'none',
                  borderBottom: rightPanelTab === 'history' ? '2px solid var(--neon-green)' : '2px solid transparent',
                  color: rightPanelTab === 'history' ? 'var(--text-main)' : 'var(--text-muted)',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                📜 HISTORY
              </button>
              <button
                onClick={() => setRightPanelTab('research')}
                style={{
                  flex: 1,
                  background: rightPanelTab === 'research' ? 'rgba(56, 189, 248, 0.05)' : 'transparent',
                  border: 'none',
                  borderBottom: rightPanelTab === 'research' ? '2px solid var(--neon-cyan)' : '2px solid transparent',
                  color: rightPanelTab === 'research' ? 'var(--text-main)' : 'var(--text-muted)',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                🔎 RESEARCH
              </button>
            </div>

            <div style={{ flex: 1, overflow: 'hidden' }}>
              {rightPanelTab === 'changes' ? (
                <ChangesPanel
                  pendingChanges={pendingChanges}
                  approvedChanges={approvedChanges}
                  onApprove={(id) => approveChange(id, true)}
                  onReject={(id) => approveChange(id, false)}
                  onApproveAll={approveAllChanges}
                  isFullScreen={false}
                  onToggleFullScreen={() => setIsChangesFullScreen(true)}
                />
              ) : rightPanelTab === 'history' ? (
                <HistoryPanel onSessionLoad={loadSession} />
              ) : (
                <ResearchPanel results={researchResults} onSearch={doResearch} />
              )}
            </div>
          </aside>
        </div>
      </div>

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
      <ConfirmationModal
        isOpen={modalConfirm.isOpen}
        onClose={() => setModalConfirm(prev => ({ ...prev, isOpen: false }))}
        onConfirm={modalConfirm.onConfirm}
        title={modalConfirm.title}
        message={modalConfirm.message}
        itemPath={modalConfirm.itemPath}
        confirmText={modalConfirm.confirmText}
        isDanger={modalConfirm.isDanger}
        coords={modalConfirm.coords}
      />
    </div>
  )
}

export default App
