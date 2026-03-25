import { X, MapPin, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'

export default function ServiceSelector({ isOpen, onClose, onSelectTour, onSelectTransfer }) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">서비스 선택</h2>
            <p className="text-sm text-gray-500 mt-1">이용하실 서비스를 선택해주세요.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 택시투어 */}
          <button
            type="button"
            onClick={() => { onClose(); onSelectTour() }}
            className="group flex flex-col items-center gap-4 rounded-2xl border-2 border-gray-200 p-6 text-left transition hover:border-yellow-400 hover:bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-yellow-400"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-yellow-100 group-hover:bg-yellow-200 transition">
              <MapPin className="h-7 w-7 text-yellow-600" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-gray-900">택시투어</p>
              <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                비에이·후라노 관광 명소를<br />코스로 둘러보는 투어 서비스
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-1">
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">겨울 코스</span>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">여름 코스</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">사계절</span>
              </div>
            </div>
          </button>

          {/* 송영서비스 */}
          <button
            type="button"
            onClick={() => { onClose(); onSelectTransfer() }}
            className="group flex flex-col items-center gap-4 rounded-2xl border-2 border-gray-200 p-6 text-left transition hover:border-blue-400 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 group-hover:bg-blue-200 transition">
              <Navigation className="h-7 w-7 text-blue-600" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-gray-900">송영서비스</p>
              <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                공항·역에서 숙소까지<br />구간 고정 요금 직행 이동
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-1">
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700">✈️ 공항 픽업/드롭</span>
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700">🚉 역 이동</span>
              </div>
            </div>
          </button>
        </div>

        <div className="px-6 pb-6">
          <p className="text-center text-xs text-gray-400">
            투어와 이동을 함께 이용하실 경우 각각 별도로 예약해 주세요.
          </p>
        </div>
      </div>
    </div>
  )
}
