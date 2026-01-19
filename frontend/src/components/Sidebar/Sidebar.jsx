
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
    const folderInputRef = useRef(null)

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                <h3 style={{ margin: 0 }}>📁 Projects</h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        onClick={onOpenFolder}
                        title="Open Folder (native picker)"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.color = 'var(--neon-purple)'}
                        onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
                    >
                        📂↗️
                    </button>
                    <button
                        onClick={handleCreateFile}
                        title="New File"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.color = 'var(--neon-cyan)'}
                        onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
                    >
                        📄+
                    </button>
                    <button
                        onClick={handleCreateFolder}
                        title="New Folder"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.color = 'var(--neon-purple)'}
                        onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
                    >
                        📂+
                    </button>
                    {files.length > 0 && (
                        <button
                            onClick={onClearWorkspace}
                            title="Clear View (files stay on disk)"
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.color = '#ef4444'}
                            onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
                        >
                            🗑️
                        </button>
                    )}
                </div>
            </div>


            {/* Upload Zone */}
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
                    background: isDragOver ? 'rgba(147, 51, 234, 0.1)' : 'transparent'
                }}
            >
                <button
                    className="btn btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.8rem' }}
                >
                    📄 Upload Files
                </button>

                <button
                    className="btn btn-secondary"
                    onClick={() => {
                        // Reset folder input value to allow re-uploading the same folder
                        if (folderInputRef.current) folderInputRef.current.value = ''
                        folderInputRef.current?.click()
                    }}
                    style={{ width: '100%', justifyContent: 'flex-start', fontSize: '0.8rem' }}
                >
                    📂 Upload Folder
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
                            onUpload(selectedFiles, false) // false = don't reset workspace
                        }
                    }}
                />

                {/* Folder Input */}
                <input
                    ref={folderInputRef}
                    type="file"
                    webkitdirectory="true"
                    directory="true"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        const selectedFiles = Array.from(e.target.files)
                        if (selectedFiles.length > 0) {
                            onUpload(selectedFiles, true) // true = clear workspace state for new folder
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

                {!workspacePath && files.length === 0 ? (
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
                        <p style={{
                            marginTop: 'var(--space-md)',
                            fontSize: '0.75rem',
                            opacity: 0.7
                        }}>
                            or drag & drop files above
                        </p>
                    </div>
                ) : (
                    isRootExpanded && (
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
