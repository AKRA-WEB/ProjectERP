'use client';

/* eslint-disable local-rules/no-hardcoded-thai */
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { get } from '@/lib/api-client';
import { 
  ArrowLeft, TrendingUp, TrendingDown,
  LineChart, Activity, Info, ShieldAlert
} from 'lucide-react';
import { Button, Card, CardHeader, CardBody, PageLoader } from '@/components/ui';

interface HistoricalPoint {
  date: string;
  qty: number;
}

interface ForecastDailyPoint {
  date: string;
  qty: number;
  upper: number;
  lower: number;
}

interface ForecastResult {
  productId: string;
  sku: string;
  name_th: string;
  name_en: string;
  history: HistoricalPoint[];
  forecast: ForecastDailyPoint[];
}

interface PageProps {
  params: Promise<{ product_id: string }>;
}

export default function ProductForecastPage({ params }: PageProps) {
  const { product_id } = use(params);

  const [data, setData] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(90);
  const [error, setError] = useState('');
  const [activeHoverPoint, setActiveHoverPoint] = useState<{ x: number; y: number; label: string; qty: number; date: string; type: 'history' | 'forecast' } | null>(null);

  const loadForecast = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await get<ForecastResult>(`/api/forecast/${product_id}?days=${days}`);
      setData(res);
    } catch (e: unknown) {
      console.error(e);
      setError('ไม่สามารถคาดการณ์ความต้องการได้ / Failed to compute SKU forecast');
    } finally {
      setLoading(false);
    }
  }, [product_id, days]);

  useEffect(() => {
    if (product_id) {
      loadForecast();
    }
  }, [loadForecast, product_id]);

  if (loading) return <PageLoader />;

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-6">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-rose-800">เกิดข้อผิดพลาดในการโหลดข้อมูล / Error Loading Forecast</h2>
          <p className="text-stone-600 text-[14px]">
            {error || 'ไม่พบข้อมูลของสินค้าที่ระบุ หรือไม่มีประวัติการทำรายการสินค้าตัวนี้ / Product not found or lacks sufficient history.'}
          </p>
          <div className="pt-2">
            <Link href="/app/analytics/sku-cut">
              <Button variant="outline" className="border-stone-300 rounded-lg">
                <ArrowLeft className="w-4 h-4 mr-2" /> กลับไปหน้าวิเคราะห์ SKU / Back to SKU Cut
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Calculate high-level stats
  const totalSalesHistorical = data.history.reduce((sum, h) => sum + h.qty, 0);
  const avgMonthlyHistorical = totalSalesHistorical / 12.0;
  
  const totalForecastedSales = data.forecast.reduce((sum, f) => sum + f.qty, 0);
  const maxForecastedDaily = Math.max(...data.forecast.map(f => f.qty));

  // Determine trend regression slope
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < 12; i++) {
    const x = i + 1;
    const y = data.history[i]?.qty ?? 0;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const slope = (12 * sumXY - sumX * sumY) / (12 * sumXX - sumX * sumX);
  const isGrowing = slope > 0.05;
  const isDeclining = slope < -0.05;

  // Render variables for SVG Chart
  const svgWidth = 800;
  const svgHeight = 350;
  const paddingLeft = 50;
  const paddingRight = 30;
  const paddingTop = 30;
  const paddingBottom = 40;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const historicalAreaWidth = chartWidth * 0.35;
  const forecastAreaWidth = chartWidth * 0.65;

  // Max value for Y scale scaling
  const maxY = Math.max(
    ...data.history.map(h => h.qty),
    ...data.forecast.map(f => f.upper),
    10
  );
  const chartMaxY = maxY * 1.15; // 15% top padding

  const getYCoord = (val: number) => {
    return paddingBottom + chartHeight - (val / chartMaxY) * chartHeight;
  };

  // Pre-calculate line points for history
  const historyPoints = data.history.map((h, i) => {
    const x = paddingLeft + (i / 11) * historicalAreaWidth;
    const y = getYCoord(h.qty);
    return { x, y, date: h.date, qty: h.qty, type: 'history' as const, label: `ประวัติ: เดือน ${12 - i} ก่อน` };
  });

  // Pre-calculate line points for forecast
  const todayX = paddingLeft + historicalAreaWidth + 20;
  const forecastPoints = data.forecast.map((f, j) => {
    const x = todayX + (j / (data.forecast.length - 1)) * (forecastAreaWidth - 20);
    const y = getYCoord(f.qty);
    const yUpper = getYCoord(f.upper);
    const yLower = getYCoord(f.lower);
    return { x, y, yUpper, yLower, date: f.date, qty: f.qty, upper: f.upper, lower: f.lower, type: 'forecast' as const, label: `คาดการณ์: วันที่ ${j + 1}` };
  });

  // Build SVG Path strings
  const historyPath = historyPoints.length > 0 
    ? `M ${historyPoints[0].x} ${historyPoints[0].y} ` + historyPoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
    : '';

  const forecastPath = forecastPoints.length > 0
    ? `M ${forecastPoints[0].x} ${forecastPoints[0].y} ` + forecastPoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
    : '';

  // Build confidence band polygon points
  const confidencePolygon = forecastPoints.length > 0
    ? forecastPoints.map(p => `${p.x},${p.yUpper}`).join(' ') + ' ' + 
      [...forecastPoints].reverse().map(p => `${p.x},${p.yLower}`).join(' ')
    : '';

  // Handle chart mouse interactions
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * svgWidth;
    
    // Find closest point among all pre-calculated points
    const allPoints = [...historyPoints, ...forecastPoints];
    let closest = allPoints[0];
    let minDist = Math.abs(closest.x - mouseX);
    
    for (const p of allPoints) {
      const dist = Math.abs(p.x - mouseX);
      if (dist < minDist) {
        minDist = dist;
        closest = p;
      }
    }
    
    if (minDist < 30) {
      setActiveHoverPoint({
        x: closest.x,
        y: closest.y,
        date: closest.date,
        qty: closest.qty,
        type: closest.type,
        label: closest.label
      });
    } else {
      setActiveHoverPoint(null);
    }
  };

  const handleMouseLeave = () => {
    setActiveHoverPoint(null);
  };

  // Convert Gregorian Month back into Thai Month string
  const formatThaiMonthStr = (dateStr: string) => {
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const d = new Date(dateStr);
    return `${months[d.getMonth()]} ${d.getFullYear() + 543}`;
  };

  const formatThaiDateStr = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate()} / ${d.getMonth() + 1} / ${d.getFullYear() + 543}`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumbs and back button */}
      <div>
        <Link href="/app/analytics/sku-cut" className="inline-flex items-center text-sm font-semibold text-emerald-600 hover:text-emerald-800 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          กลับไปหน้าวิเคราะห์ SKU / Back to SKU Cut Analysis
        </Link>
      </div>

      {/* Header card */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-[0_1px_3px_rgba(15,23,42,0.03)] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[12px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
            AI Demand Forecasting
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 mt-2">
            คาดการณ์แนวโน้มสินค้า: {data.sku}
          </h1>
          <p className="text-[14.5px] font-medium text-stone-800 mt-1">{data.name_th}</p>
          <p className="text-[12.5px] text-stone-400 mt-0.5">{data.name_en}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {[30, 90, 180].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold border transition-all ${
                days === d 
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' 
                  : 'bg-white border-stone-300 text-stone-600 hover:bg-stone-50'
              }`}
            >
              {d} วัน / Days
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-stone-200 rounded-xl shadow-sm">
          <CardBody className="p-5">
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">ยอดขายคาดการณ์ ({days} วัน)</p>
            <h3 className="text-2xl font-extrabold text-stone-900 mt-1.5 tabular-nums">
              {totalForecastedSales.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </h3>
            <span className="text-[11.5px] text-stone-400 mt-1 block">หน่วยสินค้า / Projected Units</span>
          </CardBody>
        </Card>

        <Card className="border-stone-200 rounded-xl shadow-sm">
          <CardBody className="p-5">
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">ทิศทางความต้องการ / Trend</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              {isGrowing ? (
                <>
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  <span className="text-[15px] font-bold text-emerald-700">เติบโต / Growing</span>
                </>
              ) : isDeclining ? (
                <>
                  <TrendingDown className="w-5 h-5 text-rose-600" />
                  <span className="text-[15px] font-bold text-rose-700">ถดถอย / Declining</span>
                </>
              ) : (
                <>
                  <Activity className="w-5 h-5 text-stone-500" />
                  <span className="text-[15px] font-bold text-stone-700">คงที่ / Stable</span>
                </>
              )}
            </div>
            <span className="text-[11.5px] text-stone-400 mt-1.5 block">คำนวณจาก regression slope</span>
          </CardBody>
        </Card>

        <Card className="border-stone-200 rounded-xl shadow-sm">
          <CardBody className="p-5">
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">เฉลี่ยต่อเดือนย้อนหลัง</p>
            <h3 className="text-xl font-bold text-stone-800 mt-1.5 tabular-nums">
              {avgMonthlyHistorical.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </h3>
            <span className="text-[11.5px] text-stone-400 mt-2 block">12-Month Historical Avg</span>
          </CardBody>
        </Card>

        <Card className="border-stone-200 rounded-xl shadow-sm">
          <CardBody className="p-5">
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">ปริมาณสูงสุดรายวัน (คาดการณ์)</p>
            <h3 className="text-xl font-bold text-stone-800 mt-1.5 tabular-nums">
              {maxForecastedDaily.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </h3>
            <span className="text-[11.5px] text-stone-400 mt-2 block">Max Predicted Units/Day</span>
          </CardBody>
        </Card>
      </div>

      {/* Forecasting Chart Card */}
      <Card className="border-stone-200 rounded-xl shadow-sm overflow-hidden bg-white">
        <CardHeader className="bg-stone-50/50 border-b border-stone-200 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <LineChart className="w-5 h-5 text-emerald-600" />
            <h2 className="font-semibold text-stone-800 text-[15px]">กราฟคาดการณ์ความต้องการในอีก {days} วัน (Demand Forecast Chart)</h2>
          </div>
          <div className="flex items-center gap-4 text-[12px] font-semibold text-stone-600">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-stone-400 border border-stone-400 rounded-full" />
              <span>ประวัติจริง (History)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-emerald-500 border border-emerald-500 rounded-full" />
              <span>คาดการณ์ (Forecast)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2 bg-emerald-100/50 border border-emerald-200 rounded" />
              <span>ช่วงความมั่นใจ (Confidence Band)</span>
            </div>
          </div>
        </CardHeader>
        <CardBody className="p-6 relative select-none">
          <div className="w-full flex justify-center">
            <svg 
              viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
              className="w-full max-w-4xl h-auto"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <defs>
                {/* Confidence Band Gradient */}
                <linearGradient id="confidence-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.25" />
                </linearGradient>
                {/* Underline Area Gradients */}
                <linearGradient id="history-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#78716c" stopOpacity="0.03" />
                  <stop offset="100%" stopColor="#78716c" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
                const yVal = p * chartMaxY;
                const yCoord = getYCoord(yVal);
                return (
                  <g key={idx}>
                    <line 
                      x1={paddingLeft} 
                      y1={yCoord} 
                      x2={svgWidth - paddingRight} 
                      y2={yCoord} 
                      stroke="#e7e5e4" 
                      strokeWidth={1} 
                      strokeDasharray="3 3"
                    />
                    <text 
                      x={paddingLeft - 8} 
                      y={yCoord + 4} 
                      className="text-[10.5px] tabular-nums font-semibold fill-stone-400 text-right"
                      textAnchor="end"
                    >
                      {yVal.toFixed(0)}
                    </text>
                  </g>
                );
              })}

              {/* Today Vertical Divider */}
              <line 
                x1={todayX} 
                y1={paddingTop - 10} 
                x2={todayX} 
                y2={svgHeight - paddingBottom} 
                stroke="#d6d3d1" 
                strokeWidth={1.5} 
                strokeDasharray="4 4"
              />
              <text 
                x={todayX + 6} 
                y={paddingTop - 4} 
                className="text-[11px] font-bold fill-stone-500"
              >
                วันนี้ / Today
              </text>

              {/* Labels for History Section */}
              <text 
                x={paddingLeft + historicalAreaWidth / 2} 
                y={svgHeight - 12} 
                className="text-[11.5px] font-bold fill-stone-400" 
                textAnchor="middle"
              >
                สถิติ 12 เดือนย้อนหลัง
              </text>

              {/* Labels for Forecast Section */}
              <text 
                x={todayX + forecastAreaWidth / 2} 
                y={svgHeight - 12} 
                className="text-[11.5px] font-bold fill-emerald-600" 
                textAnchor="middle"
              >
                คาดการณ์ล่วงหน้า {days} วัน
              </text>

              {/* Confidence Band Shading Area */}
              {confidencePolygon && (
                <polygon 
                  points={confidencePolygon} 
                  fill="url(#confidence-grad)" 
                  className="transition-all"
                />
              )}

              {/* History area path */}
              {historyPoints.length > 0 && (
                <path 
                  d={`${historyPath} L ${historyPoints[historyPoints.length - 1].x} ${svgHeight - paddingBottom} L ${historyPoints[0].x} ${svgHeight - paddingBottom} Z`}
                  fill="url(#history-grad)"
                />
              )}

              {/* History Line */}
              {historyPath && (
                <path 
                  d={historyPath} 
                  fill="none" 
                  stroke="#78716c" 
                  strokeWidth={2} 
                  strokeDasharray="4 2"
                  className="transition-all"
                />
              )}

              {/* Forecast Line */}
              {forecastPath && (
                <path 
                  d={forecastPath} 
                  fill="none" 
                  stroke="#059669" 
                  strokeWidth={2.8} 
                  className="transition-all"
                />
              )}

              {/* History Data points circles */}
              {historyPoints.map((p, idx) => (
                <circle 
                  key={idx}
                  cx={p.x}
                  cy={p.y}
                  r={3.5}
                  fill="#ffffff"
                  stroke="#78716c"
                  strokeWidth={1.8}
                  className="cursor-pointer"
                />
              ))}

              {/* Forecast start and end points */}
              {forecastPoints.length > 0 && (
                <>
                  <circle 
                    cx={forecastPoints[0].x}
                    cy={forecastPoints[0].y}
                    r={3.8}
                    fill="#ffffff"
                    stroke="#059669"
                    strokeWidth={2}
                  />
                  <circle 
                    cx={forecastPoints[forecastPoints.length - 1].x}
                    cy={forecastPoints[forecastPoints.length - 1].y}
                    r={3.8}
                    fill="#ffffff"
                    stroke="#059669"
                    strokeWidth={2}
                  />
                </>
              )}

              {/* Active Hover Guide Indicator Line */}
              {activeHoverPoint && (
                <g>
                  <line 
                    x1={activeHoverPoint.x} 
                    y1={paddingTop - 10} 
                    x2={activeHoverPoint.x} 
                    y2={svgHeight - paddingBottom} 
                    stroke="#a8a29e" 
                    strokeWidth={0.8}
                  />
                  <circle 
                    cx={activeHoverPoint.x} 
                    cy={activeHoverPoint.y} 
                    r={6.5} 
                    fill={activeHoverPoint.type === 'history' ? '#78716c' : '#059669'} 
                    opacity={0.35}
                  />
                  <circle 
                    cx={activeHoverPoint.x} 
                    cy={activeHoverPoint.y} 
                    r={4} 
                    fill={activeHoverPoint.type === 'history' ? '#78716c' : '#059669'} 
                  />
                </g>
              )}
            </svg>
          </div>

          {/* Interactive Hover Point Overlay Tooltip */}
          {activeHoverPoint ? (
            <div className="absolute top-[80px] left-1/2 -translate-x-1/2 bg-stone-900 border border-stone-800 rounded-lg p-3 shadow-lg flex flex-col items-center gap-1 min-w-[220px] pointer-events-none transition-all">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                {activeHoverPoint.label}
              </span>
              <span className="text-[15px] font-bold text-white tabular-nums">
                {activeHoverPoint.qty.toFixed(2)} Units
              </span>
              <span className="text-[11.5px] text-stone-400 font-medium">
                {activeHoverPoint.type === 'history' ? formatThaiMonthStr(activeHoverPoint.date) : formatThaiDateStr(activeHoverPoint.date)}
              </span>
            </div>
          ) : (
            <div className="text-center text-[12px] text-stone-400 italic mt-2.5">
              เลื่อนเมาส์ไปบนจุดของกราฟเพื่อดูปริมาณความต้องการรายวัน / Hover cursor over path points to inspect data.
            </div>
          )}
        </CardBody>
      </Card>

      {/* Helpful context information card */}
      <Card className="border-stone-200 rounded-xl shadow-sm bg-stone-50 border overflow-hidden">
        <CardBody className="p-5 flex gap-3.5 items-start">
          <Info className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <h4 className="text-[14px] font-bold text-stone-800">หลักการคำนวณและข้อสมมติของระบบจัดเตรียมคาดการณ์ (Mathematical Baseline Assumptions)</h4>
            <p className="text-[13px] text-stone-600 leading-relaxed">
              1. <strong>Seasonal Index (ดัชนีฤดูกาล):</strong> คัดแยกดัชนีการขายในรอบ 12 เดือน ป้องกันยอดขายผิดเพี้ยนจากการขายแบบกระจุกตัวในช่วงเทศกาล<br />
              2. <strong>Lifecycle Factor (ปัจจัยช่วงอายุ):</strong> นำความชันเชิงเส้น (slope) มาคูณปรับน้ำหนัก ช่วยให้ SKU ที่กำลังเติบโตมียอดพยากรณ์พุ่งขึ้น และสินค้าที่กำลังเสื่อมความนิยมยอดสโลปลดลง<br />
              3. <strong>S-Curve cumulative derivative (ส่วนอนุพันธ์สะสม):</strong> การกระจายความต้องการในแต่ละวันตามกราฟการกระจายตัวแบบโลจิสติก ช่วยจำลองความต้องการที่เริ่มก่อตัวขึ้นจนถึงจุดสมดุล
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
