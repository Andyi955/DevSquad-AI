/**
 * Sidebar Component
 * File list with upload zone
 */

import { useState, useRef } from 'react'

function Sidebar({ files, selectedFile, onSelectFile, onUpload }) {
    const [isDragOver, setIsDragOver] = useState(false)
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
                        {files.map((file) => (
                            <div
                                key={file.path}
                                className={`file-item ${selectedFile?.path === file.path ? 'active' : ''}`}
                                onClick={() => onSelectFile(file)}
                            >
                                <span className="file-icon">{getFileIcon(file.extension)}</span>
                                <span className="file-name">{file.path}</span>
                                <span className="file-size">{formatSize(file.size)}</span>
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
