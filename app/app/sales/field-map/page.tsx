'use client';

import { useState, useEffect, useCallback } from 'react';
import { get } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { Input, Button } from '@/components/ui';
import { DirectionalTransition } from '@/components/ui/directional-transition';
import type { FieldSalesCheckin } from '@/types';

interface JoinedCheckin extends FieldSalesCheckin {
  agent_name_th: string;
  agent_name_en: string;
  customer_code: string;
  customer_name_th: string;
  customer_name_en: string;
}

export default function FieldSalesMapPage() {
  const [checkins, setCheckins] = useState<JoinedCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCheckin, setSelectedCheckin] = useState<JoinedCheckin | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCheckins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<JoinedCheckin[]>(`/api/field-sales/today?date=${filterDate}`);
      setCheckins(res);
      if (res.length > 0) {
        setSelectedCheckin(res[0]);
      } else {
        setSelectedCheckin(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filterDate]);

  useEffect(() => {
    fetchCheckins();
  }, [fetchCheckins]);

  // Filter local items by agent name or customer code
  const filteredCheckins = checkins.filter(c => {
    const query = searchQuery.toLowerCase();
    const nameMatch = (c.agent_name_en || '').toLowerCase().includes(query) || (c.agent_name_th || '').toLowerCase().includes(query);
    const custMatch = c.customer_code.toLowerCase().includes(query) || c.customer_name_th.toLowerCase().includes(query);
    return nameMatch || custMatch;
  });

  // Calculate coordinates bounds to center/scale pins within SVG grid
  const lats = checkins.map(c => Number(c.gps_lat));
  const lngs = checkins.map(c => Number(c.gps_lng));
  const minLat = lats.length > 0 ? Math.min(...lats) : 13.5;
  const maxLat = lats.length > 0 ? Math.max(...lats) : 14.0;
  const minLng = lngs.length > 0 ? Math.min(...lngs) : 100.3;
  const maxLng = lngs.length > 0 ? Math.max(...lngs) : 100.8;

  // Render checkin pins onto a custom 100x100 SVG coordinate grid (Bangkok/Thailand reference)
  function getSvgCoords(latStr: number | string, lngStr: number | string) {
    const lat = Number(latStr);
    const lng = Number(lngStr);
    
    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;
    
    // Scale to SVG 800x500 box with 50px margins
    const x = lngDiff === 0 ? 400 : 50 + ((lng - minLng) / lngDiff) * 700;
    // SVG y coordinates are top-down, so invert latitude
    const y = latDiff === 0 ? 250 : 450 - ((lat - minLat) / latDiff) * 400;
    
    return { x, y };
  }

  const activeCount = checkins.filter(c => c.ended_at === null).length;
  const totalCount = checkins.length;
  const warningCount = checkins.filter(c => c.accuracy_m > 50).length;

  return (
    <DirectionalTransition>
      <div className="max-w-[1440px] mx-auto pb-12 space-y-5">
        {/* Header */}
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-stone-950 leading-tight mb-1">
              แผนที่ติดตามการเข้าพบลูกค้า / Field Sales Agent Tracking
            </h1>
            <p className="text-[13.5px] text-stone-500">
              ตรวจสอบตำแหน่งการเช็คอินแบบ Real-time ของฝ่ายขาย wholesale ในแต่ละพื้นที่
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-44">
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
            <Button variant="secondary" onClick={fetchCheckins}>
              🔄 รีเฟรช / Refresh
            </Button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-sm flex flex-col">
            <span className="text-[12.5px] font-medium text-stone-500">ผู้ใช้บริการวันนี้ / Total Check-ins</span>
            <span className="text-[24px] font-bold text-stone-950 mt-1 font-mono">{totalCount}</span>
          </div>
          <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-sm flex flex-col">
            <span className="text-[12.5px] font-medium text-stone-500">พนักงานที่กำลังเข้าพบ / Active Agents</span>
            <span className="text-[24px] font-bold text-emerald-600 mt-1 font-mono">{activeCount}</span>
          </div>
          <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-sm flex flex-col">
            <span className="text-[12.5px] font-medium text-stone-500">พิกัดคลาดเคลื่อนสูง (เกิน 50 ม.) / Unstable GPS Alerts</span>
            <span className="text-[24px] font-bold text-amber-600 mt-1 font-mono">{warningCount}</span>
          </div>
        </div>

        {/* Layout: Interactive SVG Map and Checkin List */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-stretch">
          
          {/* Map coordinate view */}
          <div className="xl:col-span-2 bg-white border border-stone-200 rounded-2xl p-5 shadow-sm min-h-[580px] flex flex-col justify-between">
            <div className="flex justify-between items-center border-b border-stone-100 pb-3">
              <h2 className="text-[15.5px] font-bold text-stone-900 flex items-center gap-2">
                🌐 ตารางพิกัดเข้าพบลูกค้าแบบจำลอง / Geo-Coordinate Grid Map
              </h2>
              <span className="text-[12px] text-stone-500 font-mono">ขอบเขต: {minLat.toFixed(4)}N - {maxLat.toFixed(4)}N / {minLng.toFixed(4)}E - {maxLng.toFixed(4)}E</span>
            </div>

            {/* SVG Plot Wrapper */}
            <div className="relative border border-stone-100 bg-stone-50 rounded-xl overflow-hidden mt-3 h-[460px]">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-stone-50/80">
                  <div className="text-center space-y-2">
                    <div className="w-8 h-8 border-2 border-stone-950 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-[12.5px] text-stone-500 font-medium">กำลังโหลดข้อมูลแผนที่...</p>
                  </div>
                </div>
              ) : checkins.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-stone-500 text-[13px]">
                  ไม่มีข้อมูลการเช็คอินในวันที่ {formatDate(filterDate)}
                </div>
              ) : (
                <svg width="100%" height="100%" viewBox="0 0 800 500" className="w-full h-full select-none">
                  {/* Grid Lines */}
                  {Array.from({ length: 9 }).map((_, i) => (
                    <line key={`x-${i}`} x1={50 + i * 87.5} y1={50} x2={50 + i * 87.5} y2={450} stroke="#e5e5e5" strokeWidth="1" strokeDasharray="3,3" />
                  ))}
                  {Array.from({ length: 6 }).map((_, i) => (
                    <line key={`y-${i}`} x1={50} y1={50 + i * 80} x2={750} y2={50 + i * 80} stroke="#e5e5e5" strokeWidth="1" strokeDasharray="3,3" />
                  ))}

                  {/* Connecting lines between same agent's check-ins to show travel path */}
                  {checkins.map((c, i) => {
                    const next = checkins.slice(i + 1).find(o => o.agent_user_id === c.agent_user_id);
                    if (!next) return null;
                    const p1 = getSvgCoords(c.gps_lat, c.gps_lng);
                    const p2 = getSvgCoords(next.gps_lat, next.gps_lng);
                    return (
                      <line
                        key={`path-${c.id}-${next.id}`}
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke="#a8a29e"
                        strokeWidth="1.5"
                        strokeDasharray="5,5"
                        className="opacity-70 animate-pulse"
                      />
                    );
                  })}

                  {/* Render Pins */}
                  {filteredCheckins.map((c) => {
                    const { x, y } = getSvgCoords(c.gps_lat, c.gps_lng);
                    const isSelected = selectedCheckin?.id === c.id;
                    const isActive = c.ended_at === null;
                    const hasHighAccuracyWarning = c.accuracy_m > 50;

                    return (
                      <g 
                        key={c.id} 
                        transform={`translate(${x}, ${y})`}
                        onClick={() => setSelectedCheckin(c)}
                        className="cursor-pointer group"
                      >
                        {/* Selected / Active glow ring */}
                        {isSelected && (
                          <circle r="18" fill="none" stroke="#000" strokeWidth="1.5" className="opacity-25 animate-ping" />
                        )}
                        {isActive && (
                          <circle r="14" fill="none" stroke="#10b981" strokeWidth="1.5" className="opacity-30 animate-pulse" />
                        )}

                        {/* Pin base marker */}
                        <circle
                          r={isSelected ? "9" : "7"}
                          fill={isActive ? "#10b981" : hasHighAccuracyWarning ? "#f59e0b" : "#44403c"}
                          stroke="white"
                          strokeWidth="2"
                          className="transition-all hover:scale-125 shadow-sm"
                        />

                        {/* Label tooltip on hover */}
                        <text
                          y="-16"
                          textAnchor="middle"
                          fill="black"
                          fontSize="10"
                          fontWeight="bold"
                          className="opacity-0 group-hover:opacity-100 bg-white border border-stone-200 p-1 transition-opacity pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
                        >
                          {c.agent_name_en} @ {c.customer_code}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>
          </div>

          {/* List panel */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div className="space-y-4 flex-1 flex flex-col justify-start">
              <h2 className="text-[15.5px] font-bold text-stone-900 border-b border-stone-100 pb-2">
                📋 ข้อมูลผู้เข้าพบ / Agent Visit Log
              </h2>

              <Input
                placeholder="ค้นหาฝ่ายขาย / คูค้า..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-[12.5px]"
              />

              {/* Scrollable checklist */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {filteredCheckins.length === 0 ? (
                  <p className="text-[12.5px] text-stone-500 italic text-center py-6">ไม่พบรายการเช็คอิน</p>
                ) : (
                  filteredCheckins.map((c) => {
                    const isSelected = selectedCheckin?.id === c.id;
                    const isActive = c.ended_at === null;

                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCheckin(c)}
                        className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-stone-950 border-stone-950 text-white shadow-sm' 
                            : 'bg-white hover:bg-stone-50 border-stone-200'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                            isSelected 
                              ? 'bg-stone-800 text-white' 
                              : isActive 
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' 
                                : 'bg-stone-100 text-stone-600'
                          }`}>
                            {isActive ? 'กำลังพบลูกค้า (Active)' : 'เช็คเอาท์แล้ว (Done)'}
                          </span>
                          <span className={`text-[10px] font-mono ${isSelected ? 'text-stone-400' : 'text-stone-500'}`}>
                            {new Date(c.checked_in_at).toLocaleTimeString('th-TH')}
                          </span>
                        </div>

                        <div className="mt-2 text-[13.5px] font-bold">
                          {c.agent_name_th} ({c.agent_name_en})
                        </div>
                        <div className={`text-[11.5px] mt-0.5 font-medium ${isSelected ? 'text-stone-300' : 'text-stone-600'}`}>
                          คู่ค้า: {c.customer_code} — {c.customer_name_th}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Selection detail popup inside panel */}
            {selectedCheckin && (
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 mt-4 space-y-2 text-[12.5px] text-stone-700">
                <h3 className="font-bold text-[13px] text-stone-900 border-b border-stone-200 pb-1.5">
                  🔍 รายละเอียดการเช็คอิน / Session Details
                </h3>
                <div className="flex justify-between">
                  <span className="text-stone-500">ฝ่ายขาย / Agent:</span>
                  <span className="font-medium text-stone-900">{selectedCheckin.agent_name_th}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">ลูกค้า / Customer:</span>
                  <span className="font-medium text-stone-900 text-right">{selectedAccrualDetailTh(selectedCheckin)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">เวลาเช็คอิน / Checked in:</span>
                  <span className="font-mono text-stone-900">{new Date(selectedCheckin.checked_in_at).toLocaleTimeString('th-TH')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">เวลาเช็คเอาท์ / Checked out:</span>
                  <span className="font-mono text-stone-900">
                    {selectedCheckin.ended_at 
                      ? new Date(selectedCheckin.ended_at).toLocaleTimeString('th-TH') 
                      : <span className="text-emerald-600 font-bold">กำลังดำเนินการ...</span>
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">GPS / Accuracy:</span>
                  <span className="font-mono text-stone-950">
                    {selectedCheckin.accuracy_m} เมตร ({Number(selectedCheckin.gps_lat).toFixed(5)}, {Number(selectedCheckin.gps_lng).toFixed(5)})
                  </span>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </DirectionalTransition>
  );
}

// Utility helper for details string rendering
function selectedAccrualDetailTh(c: JoinedCheckin) {
  return `${c.customer_code} — ${c.customer_name_th}`;
}
