import { createSignal, For, Show } from 'solid-js'

type Tier = 'gold' | 'platinum' | 'diamond'
type Plan = 'year' | 'quarter' | 'month'

const tiers: { id: Tier; name: string; mark: string; benefit: string }[] = [
  { id: 'gold', name: '黄金VIP', mark: '✦', benefit: '观影权益 · 多端畅看' },
  { id: 'platinum', name: '白金VIP', mark: '◇', benefit: '黄金权益 + 电视特权' },
  { id: 'diamond', name: '星钻VIP', mark: '✧', benefit: '白金权益 + 臻享特权' },
]

const plans: { id: Plan; name: string; per: string; renewal: string; prices: Record<Tier, number> }[] = [
  { id: 'year', name: '连续包年', per: '月', renewal: '次年续费', prices: { gold: 198, platinum: 248, diamond: 328 } },
  { id: 'quarter', name: '连续包季', per: '月', renewal: '次季续费', prices: { gold: 58, platinum: 73, diamond: 98 } },
  { id: 'month', name: '连续包月', per: '月', renewal: '次月续费', prices: { gold: 12, platinum: 15, diamond: 25 } },
]

const renewalPrices: Record<Tier, Record<Plan, number>> = {
  gold: { year: 258, quarter: 78, month: 25 },
  platinum: { year: 348, quarter: 98, month: 35 },
  diamond: { year: 428, quarter: 128, month: 45 },
}

export function MembershipModal(props: { onClose: () => void }) {
  const [tier, setTier] = createSignal<Tier>('platinum')
  const [plan, setPlan] = createSignal<Plan>('year')
  const [showResult, setShowResult] = createSignal(false)
  const currentTier = () => tiers.find(item => item.id === tier())!
  const renewalPeriod = () => ({ year: '年', quarter: '季', month: '月' })[plan()]

  return <>
    <div class="membership-scrim" />
    <section class="membership-modal" role="dialog" aria-modal="true" aria-labelledby="membership-heading">
      <button class="membership-close" aria-label="关闭会员弹窗" onClick={props.onClose}>×</button>
      <nav class="membership-tiers" aria-label="会员等级">
        <For each={tiers}>{item =>
          <button
            class="membership-tier"
            classList={{ selected: tier() === item.id }}
            aria-pressed={tier() === item.id}
            onClick={() => setTier(item.id)}
          ><span class="tier-mark" aria-hidden="true">{item.mark}</span>{item.name}</button>
        }</For>
      </nav>
      <div class="membership-body">
        <div class="membership-heading-row">
          <div>
            <span class="membership-eyebrow">MEMBERSHIP</span>
            <h2 id="membership-heading">{currentTier().benefit}</h2>
          </div>
          <span class="membership-benefit-tag">专属礼遇</span>
        </div>
        <div class="membership-plans" role="group" aria-label="选择开通周期">
          <For each={plans}>{item => {
            const price = () => item.prices[tier()]
            const monthly = () => (price() / ({ year: 12, quarter: 3, month: 1 })[item.id]).toFixed(1)
            return <button
              class="membership-plan"
              classList={{ selected: plan() === item.id }}
              aria-pressed={plan() === item.id}
              onClick={() => setPlan(item.id)}
            >
              <span class="plan-name">{item.name}</span>
              <span class="plan-price"><small>¥</small>{price()}</span>
              <span class="plan-average">折合 ¥ {monthly()}/{item.per}</span>
              <span class="plan-renewal">{item.renewal}{renewalPrices[tier()][item.id]}元</span>
            </button>
          }}</For>
        </div>
        <p class="membership-disclosure">到期按每{renewalPeriod()}{renewalPrices[tier()][plan()]}元自动续费，随时可取消。<span class="membership-info" title="可在订阅管理中取消自动续费">i</span></p>
        <button class="membership-activate" onClick={() => setShowResult(true)}>立即开通</button>
      </div>
    </section>
    <Show when={showResult()}>
      <div class="membership-result-scrim" />
      <div class="membership-result" role="alertdialog" aria-modal="true" aria-labelledby="membership-result-title">
        <span class="membership-result-symbol" aria-hidden="true">✦</span>
        <h2 id="membership-result-title">根本没有这种会员</h2>
        <button onClick={() => setShowResult(false)}>知道了</button>
      </div>
    </Show>
  </>
}
