import PolicyLayout, { Article, Bullets, PolicyTable } from '@/components/PolicyLayout.jsx'
import { companyValue } from '@/data/company.js'

export const metadata = {
  title: '취소 및 환불 정책',
  description: '잽코 택시투어의 예약 취소, 환불 기준 및 절차를 안내합니다.',
}

export default function RefundPage() {
  return (
    <PolicyLayout
      title="취소 및 환불 정책"
      description="예약 취소 시점에 따른 환불 기준과 처리 절차를 안내합니다."
    >
      <Article title="1. 예약금의 성격">
        <p>
          예약 시점에 결제되는 15,000원은 예약 요청 접수를 위한 예약금입니다. 차량 요금은 예약금에
          포함되지 않으며, 투어 이용 시 현지에서 운송사업자에게 별도로 지급합니다.
        </p>
      </Article>

      <Article title="2. 취소 시점별 환불 기준">
        <PolicyTable
          columns={['취소 시점', '환불 금액', '취소 수수료']}
          rows={[
            ['예약 확정 통지 전', '예약금 전액', '없음'],
            ['투어 시작 24시간 이전', '예약금 전액', '없음'],
            ['투어 시작 24시간 이내', '예약금의 50%', '예약금의 50%'],
            ['투어 당일 또는 미탑승', '환불 없음', '예약금 전액'],
          ]}
        />
        <p className="text-xs text-gray-500">
          기준 시각은 예약 화면에 표시된 투어 시작 일시(현지 시각)를 따릅니다.
        </p>
      </Article>

      <Article title="3. 전액 환불 사유">
        <p>아래의 경우에는 취소 시점과 관계없이 예약금 전액을 환불합니다.</p>
        <Bullets
          items={[
            '배차가 불가능하여 예약이 성립하지 않은 경우',
            '기상 악화, 도로 통제, 재해 등 안전상의 이유로 투어를 진행할 수 없는 경우',
            '운송사업자의 사정으로 투어가 취소된 경우',
            '송영 서비스에서 제시된 견적을 이용자가 수락하지 않아 예약이 성립하지 않은 경우',
          ]}
        />
        <p>
          경미한 기상 변화의 경우에는 취소 대신 실내 관광지 중심으로 코스를 조정하여 진행할 수 있으며,
          이 경우 이용자와 사전에 협의합니다.
        </p>
      </Article>

      <Article title="4. 환불 절차">
        <Bullets
          items={[
            '예약 확인 화면에서 직접 취소하거나 고객센터로 취소를 요청합니다.',
            '회사는 취소 접수 후 환불 대상 금액을 확인하여 결제 취소를 요청합니다.',
            '환불은 결제 시 사용한 수단으로 처리하는 것을 원칙으로 합니다.',
          ]}
        />
      </Article>

      <Article title="5. 환불 소요 기간">
        <PolicyTable
          columns={['결제 수단', '환불 처리 기간']}
          rows={[
            ['신용카드', '카드사 영업일 기준 3일에서 5일 이내 승인 취소'],
            ['계좌이체', '영업일 기준 3일 이내 입금'],
            ['간편결제', '결제사 정책에 따라 영업일 기준 3일에서 7일'],
          ]}
        />
        <p className="text-xs text-gray-500">
          카드사 및 결제사의 정산 일정에 따라 실제 반영 시점은 달라질 수 있습니다.
        </p>
      </Article>

      <Article title="6. 예약 변경">
        <p>
          투어 시작 24시간 이전까지는 일정, 인원, 경로의 변경을 요청할 수 있습니다. 변경 가능 여부는
          운송사업자의 배차 상황에 따라 결정되며, 변경이 불가능한 경우 취소 후 재예약으로 처리합니다.
          이 경우 취소 수수료는 제2항의 기준을 따릅니다.
        </p>
      </Article>

      <Article title="7. 문의">
        <p>
          취소 및 환불에 관한 문의는 고객센터({companyValue('phone')}, {companyValue('email')}) 또는
          서비스 내 상담 채팅으로 연락하시기 바랍니다.
        </p>
      </Article>
    </PolicyLayout>
  )
}
