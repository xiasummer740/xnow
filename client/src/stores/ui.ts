import { defineStore } from 'pinia';
export const useUiStore = defineStore('ui', {
  state: () => ({ toast: { show: false, message: '', type: 'success' }, modal: { show: false, title: '系统提示', message: '', isConfirm: false, resolve: null as any } }),
  actions: {
    showToast(message: string, type: 'success' | 'error' = 'success') { this.toast.show = true; this.toast.message = message; this.toast.type = type; setTimeout(() => { this.toast.show = false; }, 3000); },
    showConfirm(message: string, title = '安全确认'): Promise<boolean> { return new Promise((resolve) => { this.modal.title = title; this.modal.message = message; this.modal.isConfirm = true; this.modal.show = true; this.modal.resolve = resolve; }); },
    showAlert(message: string, title = '系统通知'): Promise<boolean> { return new Promise((resolve) => { this.modal.title = title; this.modal.message = message; this.modal.isConfirm = false; this.modal.show = true; this.modal.resolve = resolve; }); },
    closeModal(result: boolean) { this.modal.show = false; if (this.modal.resolve) this.modal.resolve(result); }
  }
});
