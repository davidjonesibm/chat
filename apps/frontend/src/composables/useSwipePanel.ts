import type { Ref } from 'vue';

type PanelSide = 'left' | 'right';

const MIN_SWIPE_DISTANCE = 50;
const EDGE_ZONE = 0.3;

export function useSwipePanel(side: PanelSide, isOpen: Ref<boolean>) {
  let touchStartX = 0;
  let touchStartY = 0;
  let isEdgeZone = false;

  function onTouchStart(e: TouchEvent) {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    isEdgeZone =
      side === 'left'
        ? touch.clientX <= window.innerWidth * EDGE_ZONE
        : touch.clientX >= window.innerWidth * (1 - EDGE_ZONE);
  }

  function onTouchEnd(e: TouchEvent) {
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = Math.abs(touch.clientY - touchStartY);

    if (Math.abs(dx) < MIN_SWIPE_DISTANCE || Math.abs(dx) <= dy) return;

    if (side === 'left') {
      if (isOpen.value && dx < 0) isOpen.value = false;
      else if (!isOpen.value && isEdgeZone && dx > 0) isOpen.value = true;
    } else {
      if (isOpen.value && dx > 0) isOpen.value = false;
      else if (!isOpen.value && isEdgeZone && dx < 0) isOpen.value = true;
    }
  }

  return { onTouchStart, onTouchEnd };
}
