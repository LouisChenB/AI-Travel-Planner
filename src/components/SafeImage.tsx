import { useState } from 'react'

export default function SafeImage({ src, alt, className }: { src?: string; alt?: string; className?: string }) {
  const [error, setError] = useState(false)
  if (!src || error) return null
  const isAbsolute = src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('blob:')
  const normalized = isAbsolute ? src : (src.startsWith('//') ? `https:${src}` : src)
  return (
    <img
      className={className}
      src={normalized}
      alt={alt ?? ''}
      loading="lazy"
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      onError={() => setError(true)}
    />
  )
}