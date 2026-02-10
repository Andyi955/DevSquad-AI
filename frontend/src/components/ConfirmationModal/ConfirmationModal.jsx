import React, { useEffect } from 'react'
import './ConfirmationModal.css'

const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title = '',
    message = 'Confirm?',
    itemPath = '',
    confirmText = 'Yes',
    cancelText = 'No',
    isDanger = true,
    coords = null
}) => {
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose()
        }

        if (isOpen) {
            window.addEventListener('keydown', handleEscape)
            if (!coords) document.body.style.overflow = 'hidden'
        }

        return () => {
            window.removeEventListener('keydown', handleEscape)
            document.body.style.overflow = 'auto'
        }
    }, [isOpen, onClose, coords])

    if (!isOpen) return null

    const modalStyle = coords ? {
        position: 'fixed',
        margin: 0,
        ...coords
    } : {}

    return (
        <div className={`modal-overlay ${coords ? 'transparent' : ''}`} onClick={onClose}>
            <div
                className={`confirmation-modal pill ${isDanger ? 'danger' : 'success'}`}
                style={modalStyle}
                onClick={e => e.stopPropagation()}
            >
                <div className="modal-icon">{isDanger ? '⚠️' : 'ℹ️'}</div>

                <div className="modal-content-pill">
                    <span className="modal-message-pill">{message}</span>
                    {itemPath && (
                        <span className="modal-path-pill" title={itemPath}>
                            {itemPath.split('/').pop()}
                        </span>
                    )}
                </div>

                <div className="modal-actions-pill">
                    <button className="btn-pill-cancel" onClick={onClose}>×</button>
                    <button
                        className={`btn-pill-confirm ${isDanger ? 'delete' : 'proceed'}`}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ConfirmationModal
