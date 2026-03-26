import { tourCourses } from '@/data/tourCourses.js'
import ToursPageClient from './ToursPageClient.jsx'

export const metadata = {
  title: '투어 코스 전체 보기 | 잽코 택시투어',
  description: '겨울 설경 드라이브부터 여름 라벤더 로드까지. 잽코의 비에이·후라노 택시투어 코스를 확인하세요.',
}

export default function ToursPage() {
  return <ToursPageClient courses={tourCourses} />
}
