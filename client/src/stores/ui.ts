import { defineStore } from 'pinia';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

export interface DialogOptions {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  icon?: string;
}

let seq = 0;

export const useUiStore = defineStore('ui', {
  state: () => ({
    toasts: [] as ToastItem[],
    // 老接口兼容：还有些页面在读 toast / modal
    toast: { show: false, message: '', type: 'success' as ToastType },
    modal: {
      show: false,
      kind: 'alert' as 'alert' | 'confirm' | 'prompt',
      title: '系统提示',
      message: '',
      confirmText: '确定',
      cancelText: '取消',
      danger: false,
      icon: '',
      input: '',
      placeholder: '',
      resolve: null as any,
    },
  }),
  actions: {
    // ── Toast（右上角浮动提示，可叠多条）──
    showToast(message: string, type: ToastType = 'success', duration = 2600) {
      const id = ++seq;
      this.toasts.push({ id, message: String(message ?? ''), type });
      // 老字段同步一份，避免旧代码读到 undefined
      this.toast = { show: true, message: String(message ?? ''), type };
      setTimeout(() => {
        this.toasts = this.toasts.filter((t) => t.id !== id);
        if (!this.toasts.length) this.toast.show = false;
      }, duration);
    },
    dismissToast(id: number) {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    },

    // 智能提示：按文案猜类型，替代系统 alert()，调用处不用自己判断
    notify(message: string) {
      const m = String(message ?? '');
      const bad = /失败|错误|异常|不能|太大|不匹配|请先|未|无效|已取消|驳回/.test(m);
      this.showToast(m.replace(/^[✅❌⚠️\s]+/, ''), bad ? 'error' : 'success');
    },

    // ── 弹窗：alert / confirm / prompt 三合一 ──
    _open(kind: 'alert' | 'confirm' | 'prompt', opts: DialogOptions & { placeholder?: string; defaultValue?: string }, resolve: any) {
      this.modal.kind = kind;
      this.modal.title = opts.title || (kind === 'confirm' ? '确认操作' : '提示');
      this.modal.message = opts.message || '';
      this.modal.confirmText = opts.confirmText || (kind === 'confirm' ? '确认' : '知道了');
      this.modal.cancelText = opts.cancelText || '取消';
      this.modal.danger = !!opts.danger;
      this.modal.icon = opts.icon || (kind === 'confirm' ? (opts.danger ? '⚠️' : '❓') : kind === 'prompt' ? '✏️' : '💬');
      this.modal.placeholder = opts.placeholder || '';
      this.modal.input = opts.defaultValue || '';
      this.modal.resolve = resolve;
      this.modal.show = true;
    },

    alert(message: string, title = '提示'): Promise<boolean> {
      return new Promise((resolve) => this._open('alert', { message, title }, resolve));
    },

    confirm(message: string, options: DialogOptions = {}): Promise<boolean> {
      return new Promise((resolve) => this._open('confirm', { message, title: options.title || '确认操作', ...options }, resolve));
    },

    prompt(message: string, options: DialogOptions & { placeholder?: string; defaultValue?: string } = {}): Promise<string | null> {
      return new Promise((resolve) => this._open('prompt', { message, title: options.title || '请输入', ...options }, resolve));
    },

    // 老接口
    showConfirm(message: string, title = '确认操作'): Promise<boolean> {
      return this.confirm(message, { title });
    },
    showAlert(message: string, title = '提示'): Promise<boolean> {
      return this.alert(message, title);
    },
    closeModal(result: any) {
      this.modal.show = false;
      if (this.modal.resolve) {
        const r = this.modal.resolve;
        this.modal.resolve = null;
        // prompt 取消返回 null，其余返回布尔
        r(this.modal.kind === 'prompt' ? (result === false ? null : this.modal.input) : !!result);
      }
    },
  },
});
