import { defineStore } from 'pinia';
export const useUserStore = defineStore('user', {
  state: () => ({ 
    token: localStorage.getItem('xnow_token') || '', 
    userInfo: JSON.parse(localStorage.getItem('xnow_user') || 'null') 
  }),
  actions: {
    setToken(token: string) { this.token = token; localStorage.setItem('xnow_token', token); },
    setUserInfo(user: any) { this.userInfo = user; localStorage.setItem('xnow_user', JSON.stringify(user)); },
    updateUserInfo(partialUser: any) { if (this.userInfo) { this.userInfo = { ...this.userInfo, ...partialUser }; localStorage.setItem('xnow_user', JSON.stringify(this.userInfo)); } },
    logout() { this.token = ''; this.userInfo = null; localStorage.removeItem('xnow_token'); localStorage.removeItem('xnow_user'); }
  }
});
