import { Icon } from './Icon'

export function NoticeDialog(props: {
  content: string,
  progress?: number | null,
  title?: string,
  confirmText?: string,
  showClose?: boolean,
  onClose: () => void,
  onConfirm: () => void,
}) {
  return <>
    <div class="modal-scrim" />
    <div class="notice" role="dialog" aria-modal="true" aria-labelledby="notice-title">
      {props.showClose !== false && <button class="close-notice" aria-label="关闭提示" onClick={props.onClose}>×</button>}
      <div class="notice-eye"><Icon name="eye" size={48}/></div>
      <h1 id="notice-title">{props.title ?? '提示'}</h1>
      <p>{props.content}</p>
      {props.progress !== undefined && <div class="model-progress" role="progressbar"
        aria-label="模型加载进度" aria-valuemin={props.progress === null ? undefined : 0}
        aria-valuemax={props.progress === null ? undefined : 100}
        aria-valuenow={props.progress === null ? undefined : props.progress}>
        <div class="model-progress-track"><div class="model-progress-fill" classList={{ 'model-progress-indeterminate': props.progress === null }} style={{ width: props.progress === null ? undefined : `${props.progress}%` }} /></div>
        <span>{props.progress === null ? '正在加载…' : `${props.progress}%`}</span>
      </div>}
      <button class="confirm-button" onClick={props.onConfirm}>{props.confirmText ?? '确认'}</button>
    </div>
  </>
}
