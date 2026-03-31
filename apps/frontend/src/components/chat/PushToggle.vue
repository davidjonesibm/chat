<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { usePush } from '../../composables/usePush';

const {
  pushSupported,
  pushPermission,
  subscribed,
  subscribeToPush,
  unsubscribeFromPush,
  checkExistingSubscription,
} = usePush();

const loading = ref(false);

async function handleToggle(event: Event) {
  const target = event.target as HTMLInputElement;
  const checked = target.checked;

  loading.value = true;
  try {
    if (checked) {
      const success = await subscribeToPush();
      if (!success) {
        // Reset checkbox if subscription failed
        target.checked = false;
      }
    } else {
      await unsubscribeFromPush();
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  checkExistingSubscription();
});
</script>

<template>
  <div v-if="pushSupported" class="p-3 border-t border-base-300">
    <div class="form-control">
      <label class="label cursor-pointer justify-start gap-3">
        <input
          type="checkbox"
          class="toggle toggle-primary"
          :checked="subscribed"
          :disabled="loading || pushPermission === 'denied'"
          @change="handleToggle"
        />
        <div class="flex-1">
          <span class="label-text font-medium">Push Notifications</span>
          <p
            v-if="subscribed && pushPermission === 'granted'"
            class="text-xs text-success mt-0.5"
          >
            Enabled
          </p>
          <p
            v-else-if="pushPermission === 'denied'"
            class="text-xs text-error mt-0.5"
          >
            Blocked. Enable in browser settings.
          </p>
          <p
            v-else-if="!subscribed"
            class="text-xs text-base-content/60 mt-0.5"
          >
            Disabled
          </p>
        </div>
        <span v-if="loading" class="loading loading-spinner loading-sm"></span>
      </label>
    </div>
  </div>
</template>
