
/**
 * Sidebar Component
 * File list with upload zone and recursive tree view
 */

import { useState, useRef } from 'react'
import './Sidebar.css'
import FileTree from '../FileTree/FileTree'

function Sidebar({ files, selectedFile, onSelectFile, onUpload, onAttachFiles, onClearWorkspace, onCreateFile, onCreateFolder, onUploadToPath, onMoveItem, onRenameItem, onDeleteItem, onOpenFolder, workspacePath }) {
    const [isDragOver, setIsDragOver] = useState(false)
    const [isRootExpanded, setIsRootExpanded] = useState(true)
    const [creatingItem, setCreatingItem] = useState(null) // { type: 'file' | 'folder', path: 'parent/path' }
    const fileInputRef = useRef(null)

    const handleDragOver = (e) => {
        e.preventDefault()
        setIsDragOver(true)
    }

    const handleDragLeave = () => {
        setIsDragOver(false)
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setIsDragOver(false)

        // Check for internal move first
        const sourcePath = e.dataTransfer.getData("itemPath")
        if (sourcePath && onMoveItem) {
            // Move to root (destinationFolder = '')
            onMoveItem(sourcePath, '')
            return
        }

        const droppedFiles = Array.from(e.dataTransfer.files)
        if (droppedFiles.length > 0) {
            onUpload(droppedFiles)
        }
    }

    const formatSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    // Helper to check if a path looks like a file (has extension)
    const isFilePath = (path) => {
        if (!path) return false
        const lastSegment = path.split('/').pop()
        return lastSegment.includes('.') && !lastSegment.startsWith('.')
    }

    // Helper to get the target folder for creating new items
    const getTargetFolder = (selected) => {
        if (!selected) return ''

        // Check if it's a folder (by type OR by not having a file extension)
        const isFolder = selected.type === 'folder' || !isFilePath(selected.path)

        if (isFolder) {
            return selected.path
        } else {
            // It's a file - extract parent folder from file path
            const lastSlash = selected.path.lastIndexOf('/')
            return lastSlash > 0 ? selected.path.substring(0, lastSlash) : ''
        }
    }

    const handleCreateFile = () => {
        const parentPath = getTargetFolder(selectedFile)
        console.log('📁 handleCreateFile - selectedFile:', selectedFile, 'parentPath:', parentPath)
        setCreatingItem({ type: 'file', path: parentPath })
    }

    const handleCreateFolder = () => {
        const parentPath = getTargetFolder(selectedFile)
        console.log('📁 handleCreateFolder - selectedFile:', selectedFile, 'parentPath:', parentPath)
        setCreatingItem({ type: 'folder', path: parentPath })
    }

    const handleCreateSubmit = async (name) => {
        console.log('📝 handleCreateSubmit called with name:', name)
        console.log('📂 creatingItem state:', creatingItem)

        if (!name) {
            setCreatingItem(null)
            return
        }

        const fullPath = creatingItem.path ? `${creatingItem.path}/${name}` : name
        console.log('🚀 Submitting creation request for:', fullPath)

        if (creatingItem.type === 'file') {
            await onCreateFile(fullPath)
        } else {
            await onCreateFolder(fullPath)
        }

        setCreatingItem(null)
    }

    const handleCreateCancel = () => {
        setCreatingItem(null)
    }

    return (
        <aside className="sidebar">
            <div className="workspace-header">
                <div className="workspace-title-row">
                    <h3 className="workspace-title">📁 WORKSPACE</h3>
                    <div className="workspace-actions">
                        {workspacePath && (
                            <button
                                onClick={onClearWorkspace}
                                title="Close current project"
                                className="icon-btn-danger compact"
                            >
                                🗑️
                            </button>
                        )}
                    </div>
                </div>

                <button
                    className="btn btn-primary open-project-btn"
                    onClick={onOpenFolder}
                >
                    📂 OPEN PROJECT
                </button>

                <div className="new-item-row">
                    <button onClick={handleCreateFile} className="btn btn-secondary compact">📄 New File</button>
                    <button onClick={handleCreateFolder} className="btn btn-secondary compact">📁 New Folder</button>
                </div>
            </div>


            {/* Upload Zone (Files Only Now) */}
            <div
                className={`upload-zone ${isDragOver ? 'drag-over' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{ opacity: 0.8 }}
            >
                <div className="upload-label">Quick Upload</div>
                <button
                    className="btn btn-secondary compact"
                    onClick={() => fileInputRef.current?.click()}
                >
                    📤 Select Files
                </button>

                {/* File Input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        const selectedFiles = Array.from(e.target.files)
                        if (selectedFiles.length > 0) {
                            onUpload(selectedFiles, false)
                        }
                    }}
                />
            </div>

            {/* File Tree or Empty State */}
            <div className="sidebar-tree-container">
                {/* Workspace Name Display (Hierarchical Root) */}
                {workspacePath && (
                    <div
                        className={`root-folder-node ${selectedFile === null ? 'active' : ''}`}
                        onClick={(e) => {
                            if (selectedFile !== null) {
                                onSelectFile(null)
                                setIsRootExpanded(true)
                            } else {
                                setIsRootExpanded(!isRootExpanded)
                            }
                        }}
                    >
                        <span className={`root-arrow ${isRootExpanded ? 'open' : ''}`}>▶</span>
                        <span>📂</span>
                        <span className="root-name">
                            {workspacePath.split('\\').pop() || workspacePath.split('/').pop()}
                        </span>
                    </div>
                )}

                {!workspacePath ? (
                    <div className="sidebar-no-project">
                        <div className="empty-icon">📂</div>
                        <p>No project open</p>
                        <button
                            className="btn btn-primary"
                            onClick={onOpenFolder}
                        >
                            📂 Open Folder
                        </button>
                    </div>
                ) : (
                    isRootExpanded && (
                        files.length === 0 ? (
                            <div className="sidebar-empty-project">
                                <i>Empty Project</i>
                                <div className="actions">
                                    <button
                                        onClick={onOpenFolder}
                                        className="btn btn-secondary compact"
                                    >
                                        📂 Switch Project
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <FileTree
                                files={files}
                                onSelect={onSelectFile}
                                selectedFile={selectedFile}
                                onUploadToPath={onUploadToPath}
                                onMoveItem={onMoveItem}
                                onRenameItem={onRenameItem}
                                onDeleteItem={onDeleteItem}
                                onAttachFiles={onAttachFiles}
                                creatingItem={creatingItem}
                                onCreateSubmit={handleCreateSubmit}
                                onCreateCancel={handleCreateCancel}
                            />
                        )
                    )
                )}
            </div>

            {/* Quick Stats */}
            <div className="sidebar-footer">
                <div className="sidebar-stats-row">
                    <span>{files.length} file(s)</span>
                    <span>
                        {formatSize(files.reduce((sum, f) => sum + f.size, 0))}
                    </span>
                </div>
            </div>
        </aside>
    )
}

export default Sidebar
