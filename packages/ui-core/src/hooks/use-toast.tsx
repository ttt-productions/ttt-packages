import * as React from "react";

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000;

export type ToastVariant = "default" | "destructive" | "success" | "warning" | "error";

export type ToasterToast = {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  variant?: ToastVariant;

  /** ms */
  duration?: number;

  /** show X button */
  dismissible?: boolean;
};

type ToastProps = ToasterToast;

type Action =
  | { type: "ADD_TOAST"; toast: ToastProps }
  | { type: "UPDATE_TOAST"; toast: Partial<ToastProps> & { id: string } }
  | { type: "DISMISS_TOAST"; toastId?: string }
  | { type: "REMOVE_TOAST"; toastId?: string };

interface State {
  toasts: ToastProps[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST": {
      return { ...state, toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) };
    }
    case "UPDATE_TOAST": {
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      };
    }
    case "DISMISS_TOAST": {
      const { toastId } = action;

      if (toastId) {
        return { ...state, toasts: state.toasts.map((t) => (t.id === toastId ? { ...t } : t)) };
      }

      return { ...state, toasts: state.toasts.map((t) => ({ ...t })) };
    }
    case "REMOVE_TOAST": {
      const { toastId } = action;
      if (!toastId) return { ...state, toasts: [] };
      return { ...state, toasts: state.toasts.filter((t) => t.id !== toastId) };
    }
    default:
      return state;
  }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => listener(memoryState));
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function addToRemoveQueue(toastId: string) {
  if (toastTimeouts.has(toastId)) return;

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({ type: "REMOVE_TOAST", toastId });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
}

export function toast(input: Omit<ToastProps, "id">) {
  const id = genId();

  dispatch({
    type: "ADD_TOAST",
    toast: {
      id,
      dismissible: true,
      duration: 5000,
      variant: "default",
      ...input,
    },
  });

  return {
    id,
    dismiss: () => {
      dispatch({ type: "DISMISS_TOAST", toastId: id });
      addToRemoveQueue(id);
    },
    update: (props: Partial<ToastProps>) =>
      dispatch({ type: "UPDATE_TOAST", toast: { ...props, id } }),
  };
}

export function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => {
      dispatch({ type: "DISMISS_TOAST", toastId });
      if (toastId) addToRemoveQueue(toastId);
    },
  };
}
