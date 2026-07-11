<script setup lang="ts">
import { CircleAlert } from "@lucide/vue";

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });
</script>

<template>
  <div
    class="flex items-start rounded-xl border border-[#f0c9ce] bg-[#fff6f7] leading-relaxed text-[#a94b57]"
    :class="compact ? 'gap-2 px-3 py-2.5 text-[11px]' : 'gap-2.5 px-3.5 py-3 text-[12px]'"
    role="alert"
  >
    <CircleAlert class="mt-0.5 shrink-0" :size="compact ? 14 : 16" />
    <slot />
  </div>
</template>
