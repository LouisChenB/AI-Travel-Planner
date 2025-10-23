import { useEffect, useRef } from 'react'
import type { Itinerary, Activity } from '../types'
import { getSettings } from '../storage/settings'

declare global {
  interface Window { AMap: any }
}

export default function MapView({ itinerary }: { itinerary: Itinerary }) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapObjRef = useRef<any>(null)

  const loadScript = (key: string) => {
    return new Promise<void>((resolve, reject) => {
      if ((window as any).AMap) {
        resolve()
        return
      }
      const s = document.createElement('script')
      s.src = `https://webapi.amap.com/maps?v=2.0&key=${key}`
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('AMap 脚本加载失败'))
      document.body.appendChild(s)
    })
  }

  useEffect(() => {
    const s = getSettings()
    const key = s.amapKey
    if (!key) return
    loadScript(key).then(() => {
      if (!mapRef.current) return
      const AMap = window.AMap
      mapObjRef.current = new AMap.Map(mapRef.current, { zoom: 12 })
      const activities: Activity[] = itinerary.days.flatMap(d => d.activities)
      const markers = activities
        .filter(a => typeof a.lat === 'number' && typeof a.lng === 'number')
        .map(a => new AMap.Marker({ position: [a.lng, a.lat], title: a.title }))
      mapObjRef.current.add(markers)
      if (markers.length > 0) {
        mapObjRef.current.setFitView()
      }
    }).catch(err => {
      console.error(err)
    })
  }, [itinerary])

  return <div ref={mapRef} className="map" />
}