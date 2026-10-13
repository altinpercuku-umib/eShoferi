import { useEffect } from 'react'

// Sets the browser tab title, so screen-reader users hear which page they're on.
export default function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | eShoferi` : 'eShoferi'
  }, [title])
}
