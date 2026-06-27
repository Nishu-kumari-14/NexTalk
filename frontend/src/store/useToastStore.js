import { create } from "zustand";

const useToastStore = create((set) => ({
  toasts: [], // [{ id, from, message }]

  addToast: (from, message) => {
    const id = Date.now(); // unique id for each toast
    set((state) => ({
      toasts: [...state.toasts, { id, from, message }],
    }));

    // auto-dismiss after 4 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4000);
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

export default useToastStore;