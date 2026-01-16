
/**
 * Sidebar Component
 * File list with upload zone and recursive tree view
 */

import { useState, useRef } from 'react'
import FileTree from './FileTree'

function Sidebar({ files, selectedFile, onSelectFile, onUpload, onAttachFiles, onClearWorkspace }) {
    const [isDragOver, setIsDragOver] = useState(false)
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

    return (
        <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                <h3 style={{ margin: 0 }}>📁 Projects</h3>
                {files.length > 0 && (
                    <button
                        onClick={onClearWorkspace}
                        title="Clear Projects"
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
                            onUpload(selectedFiles, true) // true = trigger archival clear and replace view
                        }
                    }}
                />
            </div>

            {/* File Tree */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                <FileTree
                    files={files}
                    onSelect={onSelectFile}
                    selectedFile={selectedFile}
                />
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
