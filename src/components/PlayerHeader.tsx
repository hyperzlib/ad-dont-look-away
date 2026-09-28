import { createSignal, Show } from 'solid-js'
import { Icon } from './Icon'

export function PlayerHeader(props: { onShowNotice: () => void }) {
  const [menuOpen, setMenuOpen] = createSignal(false)
  return <header class="top-bar">
    <button class="icon-button back-button" aria-label="返回"><Icon name="back" size={23}/></button>
    <div class="top-spacer" />
    <span class="ad-badge">广告</span>
    <div class="menu-wrap">
      <button class="icon-button more-button" aria-label="更多" aria-expanded={menuOpen()} onClick={() => setMenuOpen(!menuOpen())}><Icon name="more" size={23}/></button>
      <Show when={menuOpen()}><div class="popup top-popup"><button onClick={() => { props.onShowNotice(); setMenuOpen(false) }}>查看提示</button></div></Show>
    </div>
  </header>
}
