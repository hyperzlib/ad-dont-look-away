import { Show } from 'solid-js'

export type IconName = 'back' | 'more' | 'eye' | 'play' | 'pause' | 'volume' | 'mute' | 'full' | 'exit-full' | 'info'

export function Icon(props: { name: IconName; size?: number }) {
  const size = () => props.size ?? 22
  return <svg width={size()} height={size()} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <Show when={props.name === 'back'}><path d="m15 4-8 8 8 8" /></Show>
    <Show when={props.name === 'more'}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></Show>
    <Show when={props.name === 'eye'}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3.3"/></Show>
    <Show when={props.name === 'play'}><path d="m8 5 11 7-11 7V5Z" fill="currentColor" stroke="none"/></Show>
    <Show when={props.name === 'pause'}><path d="M8 5v14M16 5v14" stroke-width="3"/></Show>
    <Show when={props.name === 'volume'}><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M17 9a5 5 0 0 1 0 6M19 6a9 9 0 0 1 0 12"/></Show>
    <Show when={props.name === 'mute'}><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="m17 9 5 6m0-6-5 6"/></Show>
    <Show when={props.name === 'full'}><path d="M8 3H4v5m12-5h4v5M4 16v5h4m12-5v5h-4"/></Show>
    <Show when={props.name === 'exit-full'}><path d="M4 8h4V4m12 4h-4V4M4 16h4v4m12-4h-4v4"/></Show>
    <Show when={props.name === 'info'}><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></Show>
  </svg>
}
