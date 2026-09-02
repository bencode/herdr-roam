import {
  AGENT_PROMPT_IMAGE_MAX_BYTES,
  AGENT_PROMPT_IMAGE_MAX_COUNT,
  AGENT_PROMPT_IMAGE_TYPES,
} from '@herdr-roam/shared'
import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export type PastedImage = {
  readonly id: string
  readonly file: File
  readonly previewUrl: string
}

const acceptedTypes: ReadonlySet<string> = new Set(AGENT_PROMPT_IMAGE_TYPES)

export const usePromptImages = () => {
  const [images, setImages] = useState<readonly PastedImage[]>([])
  const imagesRef = useRef(images)
  imagesRef.current = images

  useEffect(
    () => () =>
      imagesRef.current.forEach(image => {
        URL.revokeObjectURL(image.previewUrl)
      }),
    [],
  )

  const add = (files: readonly File[]): string | null => {
    const invalid = files.find(
      file => !acceptedTypes.has(file.type) || file.size > AGENT_PROMPT_IMAGE_MAX_BYTES,
    )
    if (invalid) {
      return `Images must be PNG, JPEG, or WebP and no larger than ${AGENT_PROMPT_IMAGE_MAX_BYTES / 1024 / 1024} MiB.`
    }
    if (images.length + files.length > AGENT_PROMPT_IMAGE_MAX_COUNT) {
      return `A Prompt can contain at most ${AGENT_PROMPT_IMAGE_MAX_COUNT} images.`
    }
    setImages(current => [
      ...current,
      ...files.map(file => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ])
    return null
  }

  const remove = (image: PastedImage) => {
    URL.revokeObjectURL(image.previewUrl)
    setImages(current => {
      const next = current.filter(candidate => candidate.id !== image.id)
      imagesRef.current = next
      return next
    })
  }

  const clear = () => {
    images.forEach(image => {
      URL.revokeObjectURL(image.previewUrl)
    })
    imagesRef.current = []
    setImages([])
  }

  return { images, files: images.map(image => image.file), add, remove, clear }
}

export const PromptAttachments = ({
  images,
  onRemove,
}: {
  readonly images: readonly PastedImage[]
  readonly onRemove: (image: PastedImage) => void
}) => {
  if (images.length === 0) return null

  return (
    <ul className="m-0 mb-2 flex list-none flex-wrap gap-2 pl-6" aria-label="Attached images">
      {images.map(image => (
        <li
          className="group relative size-16 overflow-hidden rounded-md border border-border bg-raised"
          key={image.id}
        >
          <img
            alt={image.file.name || 'Pasted image'}
            className="size-full object-cover"
            src={image.previewUrl}
          />
          <button
            type="button"
            aria-label={`Remove ${image.file.name || 'pasted image'}`}
            className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-terminal-bg/85 text-white opacity-0 shadow-sm transition-opacity hover:bg-danger group-hover:opacity-100 focus:opacity-100 [&_svg]:size-3"
            onClick={() => onRemove(image)}
          >
            <X aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  )
}
