<script setup lang="ts">
import { computed, ref } from 'vue';
import { toStorageUrl } from '../../lib/supabase';

interface Props {
  username: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showOnlineIndicator?: boolean;
  isOnline?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  avatarUrl: null,
  size: 'md',
  showOnlineIndicator: false,
  isOnline: false,
});

const imgFailed = ref(false);

const sizeClass = computed(() => {
  const map: Record<string, string> = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };
  return map[props.size];
});

const initials = computed(() => props.username.charAt(0).toUpperCase());

const COLORS = [
  'bg-primary text-primary-content',
  'bg-secondary text-secondary-content',
  'bg-accent text-accent-content',
  'bg-info text-info-content',
  'bg-success text-success-content',
  'bg-warning text-warning-content',
  'bg-error text-error-content',
  'bg-neutral text-neutral-content',
];

const bgColor = computed(() => {
  let hash = 0;
  for (let i = 0; i < props.username.length; i++) {
    hash = props.username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
});

const resolvedUrl = computed(() => toStorageUrl(props.avatarUrl));

const showImg = computed(() => resolvedUrl.value && !imgFailed.value);

function handleImgError() {
  imgFailed.value = true;
}

const textSize = computed(() => {
  const map: Record<string, string> = {
    xs: 'text-[0.6rem]',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };
  return map[props.size];
});
</script>

<template>
  <div class="avatar" :class="{ online: showOnlineIndicator && isOnline }">
    <div :class="[sizeClass, 'rounded-full']">
      <img
        v-if="showImg"
        :src="resolvedUrl"
        :alt="`${username}'s avatar`"
        decoding="async"
        class="w-full h-full object-cover rounded-full"
        @error="handleImgError"
      />
      <div
        v-else
        role="img"
        :aria-label="username"
        :class="[bgColor, textSize]"
        class="rounded-full flex items-center justify-center w-full h-full font-semibold"
      >
        {{ initials }}
      </div>
    </div>
  </div>
</template>
