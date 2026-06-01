'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect, useCallback } from 'react';
import { get, post } from '@/lib/api-client';
import { Button, Select } from '@/components/ui';
import { DirectionalTransition } from '@/components/ui/directional-transition';
import type { Customer, FieldSalesCheckin } from '@/types';

export default function MobileCheckinPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeCheckin, setActiveCheckin] = useState<FieldSalesCheckin | null>(null);
  
  // Form states
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Geolocation states
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [geoError, setGeoError] = useState('');

  // Load customers and active checkin
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch active checkin
      const active = await get<{ data: FieldSalesCheckin | null }>('/api/field-sales/checkin');
      if (active.data) {
        setActiveCheckin(active.data);
      } else {
        setActiveCheckin(null);
      }

      // 2. Fetch customer list for check-in dropdown
      const custs = await get<{ data: Customer[] }>('/api/customers?limit=100');
      setCustomers(custs.data);
      if (custs.data.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(custs.data[0].id);
      }
    } catch (err) {
      console.error(err);
      setError('ไม่สามารถโหลดข้อมูลเริ่มต้นได้');
    } finally {
      setLoading(false);
    }
  }, [selectedCustomerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Request GPS coordinate
  const requestGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('อุปกรณ์ของคุณไม่รองรับการระบุตำแหน่ง GPS / Geolocation is not supported');
      return;
    }

    setGpsLoading(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
        });
        setGpsLoading(false);
      },
      (err) => {
        console.error(err);
        setGpsLoading(false);
        if (err.code === 1) {
          setGeoError('กรุณาอนุญาตให้เข้าถึงตำแหน่งที่ตั้ง (GPS) ในบราวเซอร์ / Geolocation permission denied');
        } else {
          setGeoError('ไม่สามารถระบุตำแหน่ง GPS ได้ในขณะนี้ / Position unavailable');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // Auto request GPS on mount
  useEffect(() => {
    requestGPS();
  }, [requestGPS]);

  // Handle Check-in Action
  async function handleCheckin() {
    setError('');
    
    if (!selectedCustomerId) {
      setError('กรุณาเลือกเลือกลูกค้า / Please select customer');
      return;
    }

    if (!coords) {
      setError('กรุณารอการระบุพิกัด GPS หรือลองกด "เรียกพิกัด GPS อีกครั้ง" / Waiting for GPS coordinates');
      return;
    }

    setSubmitting(true);
    try {
      const res = await post<{ data: FieldSalesCheckin }>('/api/field-sales/checkin', {
        customer_id: selectedCustomerId,
        gps_lat: coords.lat,
        gps_lng: coords.lng,
        accuracy_m: coords.accuracy,
      });
      setActiveCheckin(res.data);
      setError('');
    } catch (err) {
      const apiErr = err as { message?: string };
      setError(apiErr?.message || 'การเช็คอินล้มเหลว / Check-in failed');
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Check-out Action
  async function handleCheckout() {
    setError('');
    setSubmitting(true);
    try {
      await post('/api/field-sales/checkout', {});
      setActiveCheckin(null);
      setError('');
      requestGPS(); // Get fresh location for next customer
    } catch (err) {
      const apiErr = err as { message?: string };
      setError(apiErr?.message || 'การเช็คเอาท์ล้มเหลว / Check-out failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-stone-950 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[13px] text-stone-500 font-medium">กำลังโหลดข้อมูลระบบเช็คอิน...</p>
        </div>
      </div>
    );
  }

  return (
    <DirectionalTransition>
      <div className="min-h-screen bg-stone-50 text-stone-900 pb-12">
        {/* Mobile Header Banner */}
        <div className="bg-stone-950 text-white px-5 py-4 shadow-sm">
          <h1 className="text-[18px] font-bold tracking-tight">
            ลงชื่อเข้าพบลูกค้า / Field Sales Check-in
          </h1>
          <p className="text-[11px] text-stone-400 mt-0.5">
            Akra Wholesale Field Agent Portal (Mobile Web)
          </p>
        </div>

        <div className="max-w-[480px] mx-auto p-4 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-3 text-[12.5px] leading-relaxed">
              ⚠️ {error}
            </div>
          )}

          {activeCheckin ? (
            /* Active Check-in state */
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[12px] font-bold text-emerald-600 uppercase tracking-wider">กำลังเข้าพบ / Active Session</span>
              </div>

              <div className="space-y-1">
                <div className="text-[11.5px] text-stone-500">ลูกค้าที่เข้าพบ / Customer</div>
                <div className="text-[16px] font-bold text-stone-900">
                  {activeCheckin.customer_code} — {activeCheckin.customer_name_th}
                </div>
                <div className="text-[12px] text-stone-500">
                  {activeCheckin.customer_name_en}
                </div>
              </div>

              <div className="border-t border-stone-100 pt-3 space-y-2 text-[12.5px] text-stone-600">
                <div className="flex justify-between">
                  <span>เวลาเข้าพบ / Checked in at:</span>
                  <span className="font-mono font-medium">{new Date(activeCheckin.checked_in_at).toLocaleTimeString('th-TH')}</span>
                </div>
                <div className="flex justify-between">
                  <span>พิกัดเช็คอิน / Location:</span>
                  <span className="font-mono text-[11.5px] text-stone-500">
                    {Number(activeCheckin.gps_lat).toFixed(5)}, {Number(activeCheckin.gps_lng).toFixed(5)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>ความแม่นยำ / Accuracy:</span>
                  <span className="font-mono text-stone-700">{activeCheckin.accuracy_m} เมตร / meters</span>
                </div>
              </div>

              <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-xl p-3 text-[12px] leading-normal">
                <strong>💡 ข้อมูลการจองเช็คอินบรรลุผลแล้ว:</strong>
                <p className="mt-0.5 text-emerald-700">บัดนี้คุณสามารถสร้างรายการสั่งซื้อ (&quot;mobile_field&quot;) สำหรับลูกค้ารายนี้ได้แล้วอย่างปลอดภัยในรอบ 4 ชั่วโมง</p>
              </div>

              <Button
                variant="danger"
                onClick={handleCheckout}
                loading={submitting}
                className="w-full h-11 rounded-xl text-[14px] font-bold"
              >
                เช็คเอาท์ / End Session (Check-out)
              </Button>
            </div>
          ) : (
            /* Check-in form state */
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h2 className="text-[15px] font-bold text-stone-900 border-b border-stone-100 pb-2">
                ลงทะเบียนเช็คอิน / New Session Check-in
              </h2>

              <Select
                label="เลือกลูกค้าที่เข้าพบ / Customer"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                options={customers.map(c => ({ value: c.id, label: `${c.code} — ${c.name_th}` }))}
                className="h-11 text-[14px]"
              />

              {/* GPS status widget */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[12.5px] font-medium text-stone-600">ตำแหน่งพิกัดบราวเซอร์ / GPS Location</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={requestGPS}
                    loading={gpsLoading}
                    className="h-7 px-2.5 rounded-md text-[11px]"
                  >
                    🔄 เรียกพิกัดอีกครั้ง / Refresh
                  </Button>
                </div>

                {geoError ? (
                  <div className="text-[12px] text-red-600 bg-red-50 p-2.5 border border-red-100 rounded-lg">
                    {geoError}
                  </div>
                ) : coords ? (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[12px] font-mono">
                      <span className="text-stone-500">Lat/Lng:</span>
                      <span className="text-stone-900 font-bold">{coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="text-stone-500">Accuracy (ความคลาดเคลื่อน):</span>
                      <span className={`font-mono font-bold ${coords.accuracy > 50 ? 'text-amber-600' : 'text-emerald-700'}`}>
                        {coords.accuracy} เมตร / m
                      </span>
                    </div>

                    {coords.accuracy > 50 && (
                      <div className="text-[11px] text-amber-700 bg-amber-50 p-2 border border-amber-100 rounded-lg leading-normal">
                        ⚠️ <strong>พิกัดมีความคลาดเคลื่อนสูง:</strong> กรุณาเดินออกไปที่โล่งกลางแจ้งเพื่อความเสถียรของความถูกต้อง
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-[12.5px] text-stone-500 italic py-2 text-center">
                    กำลังดึงข้อมูลตำแหน่งที่ตั้ง...
                  </div>
                )}
              </div>

              <Button
                variant="primary"
                onClick={handleCheckin}
                loading={submitting || gpsLoading}
                disabled={!coords}
                className="w-full h-11 rounded-xl text-[14px] font-bold"
              >
                บันทึกการเช็คอิน / Check-in
              </Button>
            </div>
          )}
        </div>
      </div>
    </DirectionalTransition>
  );
}
