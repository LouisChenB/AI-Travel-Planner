import { useEffect, useRef } from 'react'
import type { Activity } from '../types'
import { getSettings } from '../storage/settings'

declare global {
  interface Window { AMap: any }
}

export default function MapView({ activity, height = 500 }: { activity: Activity; height?: number }) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapObjRef = useRef<any>(null)

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

  useEffect(() => {
    if (activity.type !== 'transport') return

    const s = getSettings()
    const key = s.amapKey
    const securityJsCode = s.amapSecurityJsCode
    if (!key || !securityJsCode) return

    loadScript(key, securityJsCode).then(async () => {
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
        console.warn('[MapView] 导航坐标缺失，无法渲染:', activity)
        return
      }

      try {
        const fromLoc = new AMap.LngLat(fromLng, fromLat)
        const toLoc = new AMap.LngLat(toLng, toLat)
        const mode = pickRouteMode((activity as any).method)
        console.log('[MapView] 导航模式', mode, (activity as any).from, (activity as any).fromLat, (activity as any).fromLng, (activity as any).to, (activity as any).toLat, (activity as any).toLng, (activity as any).method)

        // 统一加载相关插件，避免未加载导致构造报错
        AMap.plugin(['AMap.Driving', 'AMap.Walking', 'AMap.Transfer'], () => {
          try {
            if (!map || typeof map.getZoom !== 'function') {
              console.warn('Map 未正确初始化')
              // 仅标注起终点，避免插件错误
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
              // Transfer 对城市依赖较强，提供 map 即可让其推断；若失败会进入 catch
              const transfer = new AMap.Transfer({ map })
              transfer.search(fromLoc, toLoc)
            }

            // 起终点标注
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
  }, [activity, height])

  return <div ref={mapRef} className="map" style={{ height, width: '100%', borderRadius: 8 }} />
}