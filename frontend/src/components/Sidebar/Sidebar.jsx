
/**
 * Sidebar Component
 * File list with upload zone and recursive tree view
 */

import { useState, useRef } from 'react'
import './Sidebar.css'
import FileTree from '../FileTree/FileTree'

function Sidebar({ files, selectedFile, onSelectFile, onUpload, onAttachFiles, onClearWorkspace, onCreateFile, onCreateFolder, onUploadToPath, onMoveItem, onRenameItem, onOpenFolder, workspacePath }) {
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
        <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: 'var(--space-lg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', letterSpacing: '0.05em' }}>📁 WORKSPACE</h3>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {workspacePath && (
                            <button
                                onClick={onClearWorkspace}
                                title="Close current project"
                                className="icon-btn-danger"
                                style={{
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    color: '#ef4444',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <span>Close</span>
                                🗑️
                            </button>
                        )}
                    </div>
                </div>

                <button
                    className="btn btn-primary"
                    onClick={onOpenFolder}
                    style={{
                        width: '100%',
                        justifyContent: 'center',
                        padding: '10px',
                        background: 'linear-gradient(135deg, var(--neon-purple), var(--neon-blue))',
                        boxShadow: '0 4px 12px rgba(147, 51, 234, 0.3)'
                    }}
                >
                    📂 OPEN PROJECT FOLDER
                </button>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={handleCreateFile}
                        className="btn btn-secondary"
                        style={{ flex: 1, fontSize: '0.75rem', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                        📄 New File
                    </button>
                    <button
                        onClick={handleCreateFolder}
                        className="btn btn-secondary"
                        style={{ flex: 1, fontSize: '0.75rem', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                        📁 New Folder
                    </button>
                </div>
            </div>


            {/* Upload Zone (Files Only Now) */}
            <div
                className={`upload-zone ${isDragOver ? 'drag-over' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: 'var(--space-md)',
                    border: '1px dashed var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    marginBottom: 'var(--space-md)',
                    background: isDragOver ? 'rgba(147, 51, 234, 0.1)' : 'transparent',
                    opacity: 0.8
                }}
            >
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '4px' }}>
                    Quick Upload (Files Only)
                </div>
                <button
                    className="btn btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', padding: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}
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
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                {/* Workspace Name Display (Hierarchical Root) */}
                {workspacePath && (
                    <div
                        onClick={(e) => {
                            // If clicking the arrow or area around it, just toggle
                            // If clicking the name, select root AND ensure it's expanded
                            if (selectedFile !== null) {
                                onSelectFile(null)
                                setIsRootExpanded(true)
                            } else {
                                setIsRootExpanded(!isRootExpanded)
                            }
                        }}
                        style={{
                            marginBottom: 'var(--space-sm)',
                            padding: '8px 12px',
                            background: selectedFile === null ? 'rgba(147, 51, 234, 0.1)' : 'var(--bg-elevated)',
                            border: selectedFile === null ? '1px solid var(--neon-purple)' : '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.875rem',
                            color: 'var(--text-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            position: 'sticky',
                            top: 0,
                            zIndex: 5
                        }}
                    >
                        <span style={{
                            transform: isRootExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s',
                            display: 'inline-block',
                            fontSize: '0.7rem'
                        }}>▶</span>
                        <span>📂</span>
                        <span style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                            fontWeight: selectedFile === null ? '600' : 'normal'
                        }}>
                            {workspacePath.split('\\').pop() || workspacePath.split('/').pop()}
                        </span>
                        {selectedFile === null && <span style={{ fontSize: '0.7rem', opacity: 0.7 }}> (Root)</span>}
                    </div>
                )}

                {!workspacePath ? (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 'var(--space-xl)',
                        textAlign: 'center',
                        color: 'var(--text-muted)'
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>📂</div>
                        <p style={{ marginBottom: 'var(--space-md)' }}>No project open</p>
                        <button
                            className="btn btn-primary"
                            onClick={onOpenFolder}
                            style={{ fontSize: '0.9rem' }}
                        >
                            📂 Open Folder
                        </button>
                    </div>
                ) : (
                    isRootExpanded && (
                        files.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', opacity: 0.7 }}>
                                <i>Empty Project</i>
                                <div style={{ marginTop: '10px' }}>
                                    <button
                                        onClick={onOpenFolder}
                                        className="btn btn-secondary"
                                        style={{ fontSize: '0.8rem', padding: '4px 8px' }}
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
            <div style={{
                marginTop: 'auto',
                paddingTop: 'var(--space-md)',
                borderTop: '1px solid var(--border-color)'
            }}>
                <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    justifyContent: 'space-between'
                }}>
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
