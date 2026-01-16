
import React, { useState, useMemo } from 'react'

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

const FileTreeNode = ({ node, level = 0, onSelect, selectedPath }) => {
    const [isOpen, setIsOpen] = useState(false)

    // Toggle folder open state
    const handleToggle = (e) => {
        e.stopPropagation()
        setIsOpen(!isOpen)
    }

    // Handle file selection
    const handleSelect = (e) => {
        e.stopPropagation()
        if (node.type === 'file') {
            onSelect(node)
        } else {
            setIsOpen(!isOpen)
        }
    }

    // Indentation style
    const paddingLeft = `${level * 16 + 12}px`

    if (node.type === 'folder') {
        return (
            <div className="file-tree-node-container">
                <div
                    className={`file-tree-node folder ${selectedPath === node.path ? 'active' : ''}`}
                    style={{ paddingLeft }}
                    onClick={handleSelect}
                >
                    <span
                        className={`file-tree-arrow ${isOpen ? 'open' : ''}`}
                        onClick={handleToggle}
                    >
                        ▶
                    </span>
                    <span className="file-tree-icon">📂</span>
                    <span className="file-tree-name">{node.name}</span>
                </div>

                {isOpen && (
                    <div className="file-tree-children">
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
            className={`file-tree-node file ${selectedPath === node.path ? 'active' : ''}`}
            style={{ paddingLeft }}
            onClick={handleSelect}
        >
            <span className="file-tree-spacer"></span> {/* Align with arrow */}
            <span className="file-tree-icon">{getFileIcon(node.name)}</span>
            <span className="file-tree-name">{node.name}</span>
        </div>
    )
}

const FileTree = ({ files, onSelect, selectedFile }) => {
    // Convert flat list to tree structure
    const tree = useMemo(() => {
        const root = []
        const map = {}

        files.forEach(file => {
            const parts = file.path.split('/')
            let currentPath = ''

            parts.forEach((part, index) => {
                const isFile = index === parts.length - 1
                const parentPath = currentPath
                currentPath = currentPath ? `${currentPath}/${part}` : part

                if (!map[currentPath]) {
                    const newNode = {
                        name: part,
                        path: currentPath,
                        type: isFile ? 'file' : 'folder',
                        children: [],
                        ...file
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

    return (
        <div className="file-tree">
            {tree.map(node => (
                <FileTreeNode
                    key={node.path}
                    node={node}
                    onSelect={onSelect}
                    selectedPath={selectedFile?.path}
                />
            ))}
        </div>
    )
}

export default FileTree
