import { useEffect, useRef } from 'react'
import type { Activity } from '../types'
import { getSettings } from '../storage/settings'

declare global {
  interface Window { AMap: any }
}

export default function MapView({ activity }: { activity: Activity }) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapObjRef = useRef<any>(null)

  const loadScript = (key: string) => {
    return new Promise<void>((resolve, reject) => {
      if ((window as any).AMap) { resolve(); return }
      const s = document.createElement('script')
      s.src = `https://webapi.amap.com/maps?v=2.0&key=${key}`
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('AMap 脚本加载失败'))
      document.body.appendChild(s)
    })
  }

  const pickRouteMode = (method?: string) => {
    const m = (method || '').toLowerCase()
    if (/地铁|公交|换乘|bus|metro|subway|transfer/.test(m)) return 'Transfer'
    if (/步行|walk/.test(m)) return 'Walking'
    return 'Driving'
  }

  useEffect(() => {
    if (activity.type !== 'transport') return

    const s = getSettings()
    const key = s.amapKey
    if (!key) return

    loadScript(key).then(async () => {
      if (!mapRef.current) return
      const AMap = window.AMap
      mapObjRef.current = new AMap.Map(mapRef.current, { zoom: 12 })
      const map = mapObjRef.current
  
      const fromLat = (activity as any).fromLat
      const fromLng = (activity as any).fromLng
      const toLat = (activity as any).toLat
      const toLng = (activity as any).toLng
  
      // 仅使用经纬度导航：坐标缺失则不渲染导航
      if (
          typeof fromLat !== 'number' || typeof fromLng !== 'number' ||
          typeof toLat !== 'number' || typeof toLng !== 'number'
      ) {
          return
      }
  
      try {
          const fromLoc = new AMap.LngLat(fromLng, fromLat)
          const toLoc = new AMap.LngLat(toLng, toLat)
          const mode = pickRouteMode((activity as any).method)
          console.log('[MapView] 导航模式', mode, (activity as any).from, (activity as any).fromLat, (activity as any).fromLng, (activity as any).to, (activity as any).toLat, (activity as any).toLng, (activity as any).method)
  
          if (mode === 'Driving') {
              AMap.plugin('AMap.Driving', () => {
                  const driving = new AMap.Driving({ map })
                  driving.search(fromLoc, toLoc)
              })
          } else if (mode === 'Walking') {
              AMap.plugin('AMap.Walking', () => {
                  const walking = new AMap.Walking({ map })
                  walking.search(fromLoc, toLoc)
              })
          } else {
              AMap.plugin('AMap.Transfer', () => {
                  const transfer = new AMap.Transfer({ map })
                  transfer.search(fromLoc, toLoc)
              })
          }
  
          // 起终点标注
          const startMarker = new AMap.Marker({ position: fromLoc, title: '起点' })
          const endMarker = new AMap.Marker({ position: toLoc, title: '终点' })
          map.add([startMarker, endMarker])
          map.setFitView()
      } catch (err) {
          console.warn('导航绘制失败', err)
      }
    }).catch(err => {
      console.error(err)
    })
  }, [activity])

  return <div ref={mapRef} className="map" style={{ height: 180, borderRadius: 8 }} />
}