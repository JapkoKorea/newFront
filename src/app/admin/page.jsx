import AdminDashboard from '@/components/AdminDashboard.jsx'

// 운영자 화면. 권한 판정은 서버(/api/admin/me)가 하고, 화면은 그 결과만 따른다.
// 검색엔진에 노출될 이유가 없다.
export const metadata = {
  title: '운영자',
  robots: { index: false, follow: false },
}

export default function AdminPage() {
  return <AdminDashboard />
}
