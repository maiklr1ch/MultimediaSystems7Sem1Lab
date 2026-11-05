import { useEffect, useRef, useState } from 'react'

/** Drag & drop файлів у будь-яке місце вікна. Повертає, чи зараз щось перетягується. */
export function useFileDrop(onDrop: (file: File) => void): boolean {
  const [dragActive, setDragActive] = useState(false)
  const handlerRef = useRef(onDrop)
  handlerRef.current = onDrop

  useEffect(() => {
    // dragenter/dragleave спрацьовують на кожному дочірньому елементі, тому рахуємо вкладеність.
    let depth = 0
    const hasFiles = (event: DragEvent): boolean => event.dataTransfer?.types.includes('Files') ?? false

    const onDragEnter = (event: DragEvent): void => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth++
      setDragActive(true)
    }
    const onDragOver = (event: DragEvent): void => {
      if (!hasFiles(event)) return
      event.preventDefault() // без цього drop не спрацює
      event.dataTransfer!.dropEffect = 'copy'
    }
    const onDragLeave = (event: DragEvent): void => {
      if (!hasFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragActive(false)
    }
    const onDropEvent = (event: DragEvent): void => {
      event.preventDefault()
      depth = 0
      setDragActive(false)
      const file = event.dataTransfer?.files[0]
      if (file) handlerRef.current(file)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDropEvent)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDropEvent)
    }
  }, [])

  return dragActive
}
