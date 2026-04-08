import { ref, computed, onMounted, onUnmounted } from 'vue';

// Module-level singleton state shared across all component instances
const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null);
const isInstalled = ref(false);

export function useInstallPrompt() {
  const canInstall = computed(
    () => deferredPrompt.value !== null && !isInstalled.value,
  );

  function onBeforeInstallPrompt(e: Event) {
    e.preventDefault();
    deferredPrompt.value = e as BeforeInstallPromptEvent;
  }

  function onAppInstalled() {
    deferredPrompt.value = null;
    isInstalled.value = true;
  }

  async function promptInstall(): Promise<
    'accepted' | 'dismissed' | undefined
  > {
    const prompt = deferredPrompt.value;
    if (!prompt) return undefined;

    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    deferredPrompt.value = null;
    return outcome;
  }

  onMounted(() => {
    // Detect already-installed state
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    if (
      standaloneQuery.matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    ) {
      isInstalled.value = true;
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
  });

  onUnmounted(() => {
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.removeEventListener('appinstalled', onAppInstalled);
  });

  return { canInstall, isInstalled, promptInstall };
}
