
import React, { useState, useMemo, useRef, useEffect } from 'react'

// Helper to get icon based on extension
const getFileIcon = (name) => {
    if (!name) return '📄'
    const ext = name.slice(name.lastIndexOf('.')).toLowerCase()
    const icons = {
        '.py': '🐍',
        '.js': '📜',
        '.jsx': '⚛️',
        '.ts': '📘',
        '.tsx': '⚛️',
        '.html': '🌐',
        '.css': '🎨',
        '.scss': '🎨',
        '.json': '📋',
        '.md': '📝',
        '.txt': '📄',
        '.gitignore': '👁️',
        '.env': '🔒',
        '.sh': '💻',
        '.bat': '💻'
    }
    return icons[ext] || '📄'
}

const InlineInput = ({ type, onSubmit, onCancel, initialValue = '', noPadding = false }) => {
    const [value, setValue] = useState(initialValue)
    const inputRef = useRef(null)

    useEffect(() => {
        inputRef.current?.focus()
        // Select all text on mount for quick replacement
        inputRef.current?.setSelectionRange(0, value.length)
    }, [])

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            onSubmit(value)
        } else if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
        }
    }

    const handleBlur = () => {
        if (value.trim()) {
            onSubmit(value)
        } else {
            onCancel()
        }
    }

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: noPadding ? '0' : '4px 8px',
            paddingLeft: noPadding ? '0' : '44px',
            flex: 1
        }}>
            <input
                ref={inputRef}
                type="text"
                value={value}
                onClick={(e) => e.stopPropagation()} // Prevent row click
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                placeholder={type === 'file' ? 'name it...' : 'name it...'}
                className="file-tree-input"
                style={{
                    flex: 1,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--neon-purple)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '4px 8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    outline: 'none'
                }}
            />
        </div>
    )
}

const FileTreeNode = React.memo(({ node, level = 0, onSelect, selectedPath, onUploadToPath, onMoveItem, onRenameItem, onAttachFiles, creatingItem, onCreateSubmit, onCreateCancel }) => {
    const [isOpen, setIsOpen] = useState(false)
    const [isDragOver, setIsDragOver] = useState(false)
    const [isRenaming, setIsRenaming] = useState(false)

    // Check if this specific node is selected (not just a parent)
    const isDirectlySelected = selectedPath === node.path

    // Check if this node is a DIRECT child of a selected folder
    const isChildOfSelected = useMemo(() => {
        if (!selectedPath || node.path === selectedPath) return false
        const lastSlash = node.path.lastIndexOf('/')
        const parentPath = lastSlash >= 0 ? node.path.substring(0, lastSlash) : ''
        return parentPath === selectedPath
    }, [selectedPath, node.path])

    // Auto-open folder when creating item inside it
    useEffect(() => {
        if (creatingItem && node.type === 'folder' && creatingItem.path === node.path) {
            setIsOpen(true)
        }
    }, [creatingItem, node])

    // Toggle folder open state
    const handleToggle = (e) => {
        e.stopPropagation()
        setIsOpen(!isOpen)
        onSelect(node) // Also select the folder for "new item" scoping
    }

    // Handle file selection
    const handleSelect = (e) => {
        e.stopPropagation()
        onSelect(node)
    }

    // Drag and drop handlers for folders
    const handleDragStart = (e) => {
        // Set the item path for internal moves
        e.dataTransfer.setData("itemPath", node.path)
        e.dataTransfer.setData("itemType", node.type)

        // Also add JSON data for the AgentChat drop zone (attaching files)
        if (node.type === 'file') {
            e.dataTransfer.setData("application/json", JSON.stringify(node))
        }

        e.dataTransfer.effectAllowed = "move"
    }

    const handleDragOver = (e) => {
        if (node.type === 'folder') {
            e.preventDefault()
            e.stopPropagation()
            setIsDragOver(true)
        }
    }

    const handleDragLeave = (e) => {
        e.stopPropagation()
        setIsDragOver(false)
    }

    const handleRenameClick = (e) => {
        e.stopPropagation()
        setIsRenaming(true)
    }

    const handleRenameSubmit = async (newName) => {
        if (newName && newName !== node.name && onRenameItem) {
            await onRenameItem(node.path, newName)
        }
        setIsRenaming(false)
    }

    const handleDrop = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)

        if (node.type === 'folder') {
            // Check if it's an internal move (dragging from tree)
            const sourcePath = e.dataTransfer.getData("itemPath")

            if (sourcePath && onMoveItem) {
                // Internal move - calls move API
                // Prevent moving into itself
                if (sourcePath !== node.path) {
                    onMoveItem(sourcePath, node.path)
                }
            } else if (onUploadToPath) {
                // Check if files are actually being dropped (vs just a folder dragging over)
                // Note: Directory uploads often result in 0 length files list initially or need special handling,
                // but checking for files prevents 'upload' logic from running on internal folder moves if logic above fails.
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    onUploadToPath(Array.from(e.dataTransfer.files), node.path)
                }
            }
        }
    }

    // Indentation style
    const paddingLeft = `${level * 16 + 12}px`

    // Check if we should show the inline input here
    const shouldShowInput = creatingItem && node.type === 'folder' && creatingItem.path === node.path

    if (node.type === 'folder') {
        return (
            <div className="file-tree-node-container">
                <div
                    className={`file-tree-node folder ${isDirectlySelected ? 'active' : ''} ${isDragOver ? 'drag-over' : ''}`}
                    style={{
                        paddingLeft,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        userSelect: 'none'
                    }}
                    onClick={handleToggle} // Clicking row toggles folder
                    draggable
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    data-selected={isDirectlySelected ? 'true' : 'false'}
                >
                    <span
                        className={`file-tree-arrow ${isOpen ? 'open' : ''}`}
                        style={{
                            transition: 'transform 0.15s ease',
                            display: 'inline-block',
                            marginRight: '6px'
                        }}
                    >
                        ▶
                    </span>
                    <span className="file-tree-icon" style={{ marginRight: '6px' }}>📂</span>
                    {isRenaming ? (
                        <InlineInput
                            type="folder"
                            initialValue={node.name}
                            noPadding
                            onSubmit={handleRenameSubmit}
                            onCancel={() => setIsRenaming(false)}
                        />
                    ) : (
                        <span className="file-tree-name">{node.name}</span>
                    )}
                    {!isRenaming && (
                        <div className="node-actions">
                            <button
                                className="rename-btn"
                                onClick={handleRenameClick}
                                title="Rename"
                            >
                                ✏️
                            </button>
                        </div>
                    )}
                </div>


                {isOpen && (
                    <div className="file-tree-children">
                        {shouldShowInput && (
                            <InlineInput
                                type={creatingItem.type}
                                onSubmit={onCreateSubmit}
                                onCancel={onCreateCancel}
                            />
                        )}
                        {node.children
                            .sort((a, b) => {
                                // Sort folders first, then files
                                if (a.type === b.type) return a.name.localeCompare(b.name)
                                return a.type === 'folder' ? -1 : 1
                            })
                            .map((child) => (
                                <FileTreeNode
                                    key={child.path}
                                    node={child}
                                    level={level + 1}
                                    onSelect={onSelect}
                                    selectedPath={selectedPath}
                                    onUploadToPath={onUploadToPath}
                                    onMoveItem={onMoveItem}
                                    onRenameItem={onRenameItem}
                                    onAttachFiles={onAttachFiles}
                                    creatingItem={creatingItem}
                                    onCreateSubmit={onCreateSubmit}
                                    onCreateCancel={onCreateCancel}
                                />
                            ))
                        }
                    </div>
                )}
            </div>
        )
    }

    return (
        <div
            className={`file-tree-node file ${isDirectlySelected ? 'active' : ''} ${isChildOfSelected ? 'child-of-selected' : ''}`}
            style={{ paddingLeft }}
            onClick={handleSelect}
            data-selected={isDirectlySelected ? 'true' : 'false'}
            draggable // Enable dragging files
            onDragStart={handleDragStart}
        >
            <span className="file-tree-spacer" style={{ width: '16px', display: 'inline-block', marginRight: '6px' }}></span> {/* Align with arrow */}
            <span className="file-tree-icon" style={{ marginRight: '6px' }}>{getFileIcon(node.name)}</span>
            {isRenaming ? (
                <InlineInput
                    type="file"
                    initialValue={node.name}
                    noPadding
                    onSubmit={handleRenameSubmit}
                    onCancel={() => setIsRenaming(false)}
                />
            ) : (
                <span className="file-tree-name">{node.name}</span>
            )}
            {!isRenaming && (
                <div className="node-actions">
                    <button
                        className="attach-btn"
                        onClick={(e) => {
                            e.stopPropagation()
                            onAttachFiles && onAttachFiles(node)
                        }}
                        title="Add to Chat"
                    >
                        ➕
                    </button>
                    <button
                        className="rename-btn"
                        onClick={handleRenameClick}
                        title="Rename"
                    >
                        ✏️
                    </button>
                </div>
            )}
        </div>
    )
})

const FileTree = ({ files, onSelect, selectedFile, onUploadToPath, onMoveItem, onRenameItem, onAttachFiles, creatingItem, onCreateSubmit, onCreateCancel }) => {
    // Convert flat list to tree structure
    const tree = useMemo(() => {
        const root = []
        const map = {}

        files.forEach(file => {
            const parts = file.path.split('/')
            let currentPath = ''

            parts.forEach((part, index) => {
                const isLeaf = index === parts.length - 1
                const parentPath = currentPath
                currentPath = currentPath ? `${currentPath}/${part}` : part

                if (!map[currentPath]) {
                    const newNode = {
                        name: part,
                        path: currentPath,
                        type: 'folder', // Default for intermediate parts
                        children: []
                    }

                    // If this is the actual item from the backend, merge all properties (including correct type)
                    if (isLeaf) {
                        Object.assign(newNode, file)
                    }

                    map[currentPath] = newNode

                    if (index === 0) {
                        root.push(newNode)
                    } else if (map[parentPath]) {
                        if (!map[parentPath].children.find(c => c.path === currentPath)) {
                            map[parentPath].children.push(newNode)
                        }
                    }
                }
            })
        })

        // Final recursive sort
        const sortTree = (nodes) => {
            return nodes.sort((a, b) => {
                if (a.type === b.type) return a.name.localeCompare(b.name)
                return a.type === 'folder' ? -1 : 1
            }).map(node => ({
                ...node,
                children: sortTree(node.children)
            }))
        }

        return sortTree(root)
    }, [files])

    if (!files || files.length === 0) {
        return <div className="file-tree-empty">No files in workspace</div>
    }

    // Check if creating item at root level (no parent path)
    const shouldShowRootInput = creatingItem && creatingItem.path === ''

    const handleDrop = (e) => {
        // Only handle if it's an internal move and wasn't handled by a specific folder
        const sourcePath = e.dataTransfer.getData("itemPath")
        if (sourcePath && onMoveItem) {
            e.preventDefault()
            e.stopPropagation()
            onMoveItem(sourcePath, '') // Move to root
        }
    }

    return (
        <div
            className="file-tree"
            onDragOver={(e) => {
                // Allow drops in the general tree area
                if (e.dataTransfer.types.includes("itemPath")) {
                    e.preventDefault()
                }
            }}
            onDrop={handleDrop}
            style={{ minHeight: '100px' }} // Ensure there's a drop target area even if tree is short
        >
            {shouldShowRootInput && (
                <InlineInput
                    type={creatingItem.type}
                    onSubmit={onCreateSubmit}
                    onCancel={onCreateCancel}
                />
            )}
            {tree.map(node => (
                <FileTreeNode
                    key={node.path}
                    node={node}
                    onSelect={onSelect}
                    selectedPath={selectedFile?.path}
                    onUploadToPath={onUploadToPath}
                    onMoveItem={onMoveItem}
                    onRenameItem={onRenameItem}
                    onAttachFiles={onAttachFiles}
                    creatingItem={creatingItem}
                    onCreateSubmit={onCreateSubmit}
                    onCreateCancel={onCreateCancel}
                />
            ))}
        </div>
    )
}

export default FileTree
