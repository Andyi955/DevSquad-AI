/**
 * Sidebar Component
 * File list with upload zone
 */

import { useState, useRef } from 'react'

function Sidebar({ files, selectedFile, onSelectFile, onUpload, onAttachFiles }) {
    const [isDragOver, setIsDragOver] = useState(false)
    const [selectedPaths, setSelectedPaths] = useState([])
    const lastClickedIndex = useRef(-1)
    const fileInputRef = useRef(null)

    const handleFileClick = (e, file, index) => {
        let newSelected = [...selectedPaths]

        if (e.ctrlKey || e.metaKey) {
            // Toggle selection
            if (newSelected.includes(file.path)) {
                newSelected = newSelected.filter(p => p !== file.path)
            } else {
                newSelected.push(file.path)
            }
        } else if (e.shiftKey && lastClickedIndex.current !== -1) {
            // Range selection
            const start = Math.min(lastClickedIndex.current, index)
            const end = Math.max(lastClickedIndex.current, index)
            const rangePaths = files.slice(start, end + 1).map(f => f.path)

            // Add range to existing selection, but filter duplicates
            newSelected = Array.from(new Set([...newSelected, ...rangePaths]))
        } else {
            // Single selection
            newSelected = [file.path]
            onSelectFile(file)
        }

        setSelectedPaths(newSelected)
        lastClickedIndex.current = index
    }

    const handleDragStart = (e, file) => {
        // If the dragged file is part of the selection, drag all selected files
        // Otherwise, just drag the single file
        const filesToDrag = selectedPaths.includes(file.path)
            ? files.filter(f => selectedPaths.includes(f.path))
            : [file]

        e.dataTransfer.setData('application/json', JSON.stringify(filesToDrag))
        e.dataTransfer.effectAllowed = 'copy'

        // Show ghost image text for multiple files
        if (filesToDrag.length > 1) {
            const dragIcon = document.createElement('div')
            dragIcon.innerText = `📄 ${filesToDrag.length} files`
            dragIcon.style.padding = '8px 12px'
            dragIcon.style.background = 'var(--neon-blue)'
            dragIcon.style.borderRadius = '8px'
            dragIcon.style.position = 'absolute'
            dragIcon.style.top = '-1000px'
            document.body.appendChild(dragIcon)
            e.dataTransfer.setDragImage(dragIcon, 0, 0)
            setTimeout(() => document.body.removeChild(dragIcon), 0)
        }
    }

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

        const droppedFiles = Array.from(e.dataTransfer.files)
        if (droppedFiles.length > 0) {
            onUpload(droppedFiles)
        }
    }

    const handleFileSelect = (e) => {
        const selectedFiles = Array.from(e.target.files)
        if (selectedFiles.length > 0) {
            onUpload(selectedFiles)
        }
    }

    const getFileIcon = (ext) => {
        const icons = {
            '.py': '🐍',
            '.js': '📜',
            '.jsx': '⚛️',
            '.ts': '📘',
            '.tsx': '⚛️',
            '.html': '🌐',
            '.css': '🎨',
            '.json': '📋',
            '.md': '📝',
            '.txt': '📄'
        }
        return icons[ext] || '📄'
    }

    const formatSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    return (
        <aside className="sidebar">
            <h3 style={{ marginBottom: 'var(--space-md)' }}>📁 Workspace</h3>

            {/* Upload Zone */}
            <div
                className={`upload-zone ${isDragOver ? 'drag-over' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <div className="upload-zone-icon">📤</div>
                <div className="upload-zone-text">
                    Drop files here or click to upload
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".py,.js,.jsx,.ts,.tsx,.html,.css,.json,.md,.txt"
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                />
            </div>

            {/* File List */}
            <div style={{ marginTop: 'var(--space-lg)' }}>
                {files.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        padding: 'var(--space-lg)'
                    }}>
                        No files yet
                    </div>
                ) : (
                    <div className="file-list">
                        {files.map((file, index) => (
                            <div
                                key={file.path}
                                className={`file-item ${selectedPaths.includes(file.path) ? 'active' : ''}`}
                                onClick={(e) => handleFileClick(e, file, index)}
                                draggable
                                onDragStart={(e) => handleDragStart(e, file)}
                            >
                                <span className="file-icon">{getFileIcon(file.extension)}</span>
                                <span className="file-name">{file.path}</span>
                                <span className="file-size">{formatSize(file.size)}</span>
                                <button
                                    className="btn-add-to-chat"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onAttachFiles(file)
                                    }}
                                    title="Add to chat"
                                >
                                    +
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Quick Stats */}
            <div style={{
                marginTop: 'auto',
                paddingTop: 'var(--space-lg)',
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
