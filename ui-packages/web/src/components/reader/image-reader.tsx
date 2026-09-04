import type { ProjectFileView } from '@herdr-roam/shared'
import styles from './style.module.scss'

type ImageFile = Extract<ProjectFileView, { kind: 'image' }>

export const ImageReader = ({ file, src }: { readonly file: ImageFile; readonly src: string }) => (
  <div className={styles.imageReader}>
    <img src={src} alt={file.name} />
  </div>
)
