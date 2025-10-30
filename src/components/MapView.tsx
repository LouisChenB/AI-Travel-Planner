import { useEffect, useRef, useState } from 'react'
import type { Activity } from '../types'
import { getSettings } from '../storage/settings'

declare global {
  interface Window { AMap: any }
}

export default function MapView({ activity, height = 500 }: { activity: Activity; height?: number }) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapObjRef = useRef<any>(null)
  const [isVisible, setIsVisible] = useState(false)

  const loadScript = (key: string, securityJsCode: string) => {
    return new Promise<void>((resolve, reject) => {
      if ((window as any).AMap) { resolve(); return }
      (window as any)._AMapSecurityConfig = {
        securityJsCode: securityJsCode,
      };
      const s = document.createElement('script')
      s.src = `https://webapi.amap.com/maps?key=${key}&v=2.0&plugin=AMap.Driving,AMap.Walking,AMap.Transfer`
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('AMap 脚本加载失败'))
      document.body.appendChild(s)
    })
  }

  const pickRouteMode = (method?: string) => {
    const m = (method || '').toLowerCase()
    if (/飞机|动车|高铁|地铁|公交|换乘|bus|metro|subway|transfer/.test(m)) return 'Transfer'
    if (/步行|walk/.test(m)) return 'Walking'
    return 'Driving'
  }

  // 仅当进入视窗时才标记为可见，触发地图初始化
  useEffect(() => {
    const el = mapRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setIsVisible(true)
        })
      },
      { root: null, threshold: 0.1 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // 卸载时销毁地图，释放资源
  useEffect(() => {
    return () => {
      if (mapObjRef.current && typeof mapObjRef.current.destroy === 'function') {
        try { mapObjRef.current.destroy() } catch {}
        mapObjRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    // 未进入视窗或非交通活动，不加载地图
    if (!isVisible) return
    if (activity.type !== 'transport') return

    const s = getSettings()
    const key = s.amapKey
    const securityJsCode = s.amapSecurityJsCode
    if (!key || !securityJsCode) return

    loadScript(key, securityJsCode).then(async () => {
      if (!mapRef.current) return
      const AMap = window.AMap
      // 仅初始化一次
      if (!mapObjRef.current) {
        mapObjRef.current = new AMap.Map(mapRef.current, { zoom: 12 })
      }
      const map = mapObjRef.current

      const fromLat = (activity as any).fromLat
      const fromLng = (activity as any).fromLng
      const toLat = (activity as any).toLat
      const toLng = (activity as any).toLng

      if (
        typeof fromLat !== 'number' || typeof fromLng !== 'number' ||
        typeof toLat !== 'number' || typeof toLng !== 'number'
      ) {
        console.warn('[MapView] 导航坐标缺失，无法渲染:', activity)
        return
      }

      try {
        const fromLoc = new AMap.LngLat(fromLng, fromLat)
        const toLoc = new AMap.LngLat(toLng, toLat)
        const mode = pickRouteMode((activity as any).method)
        console.log('[MapView] 导航模式', mode, (activity as any).from, (activity as any).fromLat, (activity as any).fromLng, (activity as any).to, (activity as any).toLat, (activity as any).toLng, (activity as any).method)

        // 每次重绘前清空覆盖物，避免重复叠加
        if (map && typeof map.clearMap === 'function') {
          map.clearMap()
        }

        AMap.plugin(['AMap.Driving', 'AMap.Walking', 'AMap.Transfer'], () => {
          try {
            if (!map || typeof map.getZoom !== 'function') {
              console.warn('Map 未正确初始化')
              const startMarker = new AMap.Marker({ position: fromLoc, title: '起点' })
              const endMarker = new AMap.Marker({ position: toLoc, title: '终点' })
              map.add([startMarker, endMarker])
              map.setFitView()
              return
            }

            if (mode === 'Driving') {
              const driving = new AMap.Driving({ map })
              driving.search(fromLoc, toLoc)
            } else if (mode === 'Walking') {
              const walking = new AMap.Walking({ map })
              walking.search(fromLoc, toLoc)
            } else {
              const transfer = new AMap.Transfer({ map })
              transfer.search(fromLoc, toLoc)
            }

            const startMarker = new AMap.Marker({ position: fromLoc, title: '起点' })
            const endMarker = new AMap.Marker({ position: toLoc, title: '终点' })
            map.add([startMarker, endMarker])

            map.setFitView()
          } catch (err) {
            console.warn('导航绘制失败，降级为仅标注起终点', err)
            try {
              const startMarker = new AMap.Marker({ position: fromLoc, title: '起点' })
              const endMarker = new AMap.Marker({ position: toLoc, title: '终点' })
              map.add([startMarker, endMarker])
              map.setFitView()
            } catch {}
          }
        })
      } catch (err) {
        console.warn('导航绘制失败', err)
      }
    }).catch(err => {
      console.error(err)
    })
  }, [activity, height, isVisible])

  return <div ref={mapRef} className="map" style={{ height, width: '100%', borderRadius: 8 }} />
}