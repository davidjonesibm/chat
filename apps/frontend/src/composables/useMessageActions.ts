import { ref } from 'vue';
import type { MessageWithSender } from '@chat/shared';
import { useToast } from './useToast';

export const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

// Singleton mobile breakpoint — shared by all callers
const mql =
  typeof window !== 'undefined'
    ? window.matchMedia('(max-width: 767px)')
    : null;
const isMobile = ref(mql?.matches ?? false);
if (mql) {
  mql.addEventListener('change', (e) => {
    isMobile.value = e.matches;
  });
}

export function useMessageActions() {
  const { addToast } = useToast();

  const activeMessage = ref<MessageWithSender | null>(null);
  const isOpen = ref(false);
  const showFullPicker = ref(false);

  function open(message: MessageWithSender) {
    activeMessage.value = message;
    isOpen.value = true;
    showFullPicker.value = false;
  }

  function close() {
    isOpen.value = false;
    showFullPicker.value = false;
  }

  async function copyMessage() {
    if (!activeMessage.value) return;
    try {
      await navigator.clipboard.writeText(activeMessage.value.content);
      addToast('success', 'Copied to clipboard');
    } catch {
      addToast('error', 'Failed to copy');
    }
    close();
  }

  async function shareMessage() {
    if (!activeMessage.value) return;
    if (navigator.share) {
      try {
        await navigator.share({ text: activeMessage.value.content });
        addToast('success', 'Shared successfully');
      } catch (err) {
        // User cancelled share — not an error
        if (err instanceof DOMException && err.name === 'AbortError') {
          close();
          return;
        }
        await copyMessage();
        return;
      }
      close();
    } else {
      await copyMessage();
    }
  }

  function reply() {
    addToast('info', 'Reply is coming soon');
    close();
  }

  return {
    activeMessage,
    isOpen,
    showFullPicker,
    isMobile,
    open,
    close,
    copyMessage,
    shareMessage,
    reply,
  };
}
